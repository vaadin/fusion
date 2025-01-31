/**
 *    Copyright 2000-2024 Vaadin Ltd
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.vaadin.hilla.gradle.plugin

import com.vaadin.gradle.VaadinFlowPluginExtension
import com.vaadin.gradle.VaadinPlugin
import com.vaadin.hilla.engine.EngineConfiguration
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.file.DuplicatesStrategy
import org.gradle.api.internal.provider.DefaultListProperty
import org.gradle.api.plugins.JavaPlugin
import org.gradle.api.tasks.Copy
import org.gradle.api.tasks.SourceSet
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.bundling.Jar
import java.nio.file.Path
import java.util.stream.Stream

/**
 * The main class of the Hilla Gradle Plugin
 */
public class HillaPlugin : Plugin<Project> {
    private val JSR_305_STRICT = "-Xjsr305=strict"
    private val EMIT_JVM_TYPE_ANNOTATIONS = "-Xemit-jvm-type-annotations"

    override fun apply(project: Project) {
        // we need Java Plugin conventions so that we can ensure the order of tasks
        project.pluginManager.apply(JavaPlugin::class.java)

        // we apply Vaadin (flow) plugin so that the users do not need to add it themselves
        // to leverage from vaadinPrepareFrontend and vaadinBuildFrontend:
        project.pluginManager.apply(VaadinPlugin::class.java)

        // only register Hilla tasks in projects that use Spring Boot
        if (project.plugins.hasPlugin("org.springframework.boot")) {
            project.tasks.replace("vaadinBuildFrontend", EngineBuildFrontendTask::class.java)

            project.tasks.apply {
                register("hillaConfigure", EngineConfigureTask::class.java)
                register("hillaGenerate", EngineGenerateTask::class.java)
            }

            project.tasks.named("vaadinBuildFrontend") {
                it.dependsOn("hillaConfigure")
            }
        }

        // Configure Kotlin-specific tasks only if Kotlin JVM plugin is applied
        project.plugins.withId("org.jetbrains.kotlin.jvm") {
            project.tasks.named("compileKotlin").configure { task ->
                val compilerOptions = task.javaClass.methods.find { it.name == "getCompilerOptions" }?.invoke(task)
                if (compilerOptions != null) {
                    val freeCompilerArgs = compilerOptions.javaClass.methods.find { it.name == "getFreeCompilerArgs" }
                        ?.invoke(compilerOptions) as? DefaultListProperty<String>
                    freeCompilerArgs?.addAll(listOf(JSR_305_STRICT, EMIT_JVM_TYPE_ANNOTATIONS)) ?:
                    project.logger.warn("""
                        Kotlin JVM plugin is applied and 'compilerOption' was not null, but could not acquire the
                        'freeCompilerArgs' instance from the 'compilerOption' to configure Kotlin compiler options by
                         adding '$JSR_305_STRICT' and '$EMIT_JVM_TYPE_ANNOTATIONS'. To make sure annotation based form
                         validations are enabled, add the above compiler args in the build file explicitly.""".trimIndent())
                } else {
                    project.logger.warn("""
                        Kotlin JVM plugin is applied, but could not acquire the 'compilerOption' instance from the
                        'compileKotlin' task instance to configure Kotlin compiler options by adding '$JSR_305_STRICT'
                         and '$EMIT_JVM_TYPE_ANNOTATIONS' to the 'freeCompilerArgs'. To make sure annotation based form
                         validations are enabled, add the above compiler args in the build file explicitly.""".trimIndent())
                }
            }
        }

        project.tasks.withType(Jar::class.java) { task: Jar ->
            task.mustRunAfter("vaadinBuildFrontend")
        }

        project.tasks.named("processResources") {
            val copyTask = it as? Copy
            if (copyTask != null) {
                copyTask.duplicatesStrategy = DuplicatesStrategy.EXCLUDE
            }
        }
    }

    public companion object {
        public fun createEngineConfiguration(project: Project, vaadinExtension: VaadinFlowPluginExtension): EngineConfiguration {
            val baseDir: Path = project.projectDir.toPath()
            val buildDir: Path = baseDir.resolve(vaadinExtension.projectBuildDir.get())

            val sourceSets: SourceSetContainer by lazy {
                project.extensions.getByType(SourceSetContainer::class.java)
            }
            val sourceSet = sourceSets.getByName(vaadinExtension.sourceSetName.get()) as SourceSet
            val classpathElements = sourceSet.runtimeClasspath.elements.get().stream().map { it.toString() }
            val pluginClasspath = project.buildscript.configurations.getByName("classpath")
                .resolve().stream().map { it.toString() }.filter { it.contains("-loader-tools") }
            val classpath = Stream.concat(pluginClasspath, classpathElements).distinct().toList()

            return EngineConfiguration.Builder()
                .baseDir(baseDir)
                .buildDir(buildDir)
                .classesDir(sourceSet.output.classesDirs.singleFile.toPath())
                .outputDir(vaadinExtension.generatedTsFolder.get().toPath())
                .groupId(project.group.toString().takeIf { it.isNotEmpty() } ?: "unspecified")
                .artifactId(project.name)
                .classpath(classpath)
                .withDefaultAnnotations()
                .mainClass(project.findProperty("mainClass") as String?)
                .productionMode(vaadinExtension.productionMode.getOrElse(false))
                .build()
        }
    }
}
