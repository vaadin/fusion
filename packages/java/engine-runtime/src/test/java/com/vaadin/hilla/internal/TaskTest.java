package com.vaadin.hilla.internal;

import static com.vaadin.flow.server.frontend.FrontendUtils.PARAM_FRONTEND_DIR;

import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.function.Function;
import java.util.stream.Stream;

import com.vaadin.hilla.ApplicationContextProvider;
import com.vaadin.hilla.internal.fixtures.CustomEndpoint;
import com.vaadin.hilla.internal.fixtures.EndpointNoValue;
import com.vaadin.hilla.internal.fixtures.MyEndpoint;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;

import com.vaadin.flow.server.frontend.FrontendUtils;
import com.vaadin.hilla.engine.EngineConfiguration;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(classes = { CustomEndpoint.class, EndpointNoValue.class,
        MyEndpoint.class, ApplicationContextProvider.class })
public class TaskTest {
    private Path temporaryDirectory;

    @BeforeEach
    public void setUpTaskApplication() throws IOException, URISyntaxException,
            FrontendUtils.CommandExecutionException, InterruptedException {
        temporaryDirectory = Files.createTempDirectory(getClass().getName());
        temporaryDirectory.toFile().deleteOnExit();
        var userDir = temporaryDirectory.toAbsolutePath().toString();
        System.setProperty("user.dir", userDir);
        System.clearProperty(PARAM_FRONTEND_DIR);

        var buildDir = getTemporaryDirectory().resolve(getBuildDirectory());
        Files.createDirectories(buildDir);

        var frontendDir = getTemporaryDirectory()
                .resolve(getFrontendDirectory());
        Files.createDirectories(frontendDir);

        Path packagesPath = Path
                .of(getClass().getClassLoader().getResource("").toURI())
                .getParent() // target
                .getParent() // engine-runtime
                .getParent() // java
                .getParent(); // packages

        Path projectRoot = packagesPath.getParent();
        Files.copy(projectRoot.resolve(".npmrc"),
                temporaryDirectory.resolve(".npmrc"));
        var tsPackagesDirectory = packagesPath.resolve("ts");

        var shellCmd = FrontendUtils.isWindows() ? Stream.of("cmd.exe", "/c")
                : Stream.<String> empty();

        var npmCmd = Stream.of("npm", "--no-update-notifier", "--no-audit",
                "install", "--no-save", "--install-links");

        var generatorFiles = Files.list(tsPackagesDirectory)
                .map(Path::toString);

        var command = Stream.of(shellCmd, npmCmd, generatorFiles)
                .flatMap(Function.identity()).toList();

        var processBuilder = FrontendUtils.createProcessBuilder(command)
                .directory(temporaryDirectory.toFile())
                .redirectOutput(ProcessBuilder.Redirect.INHERIT)
                .redirectError(ProcessBuilder.Redirect.INHERIT);
        var exitCode = processBuilder.start().waitFor();
        if (exitCode != 0) {
            throw new FrontendUtils.CommandExecutionException(exitCode);
        }
    }

    @AfterEach
    public void tearDownTaskApplication() throws IOException {
        FrontendUtils.deleteDirectory(temporaryDirectory.toFile());
    }

    protected String getBuildDirectory() {
        return "build";
    }

    protected String getClassesDirectory() {
        return "build/classes";
    }

    protected Path getOpenAPIFile() {
        return getTemporaryDirectory().resolve(getBuildDirectory())
                .resolve(EngineConfiguration.OPEN_API_PATH);
    }

    protected String getFrontendDirectory() {
        return "frontend";
    }

    protected String getOutputDirectory() {
        return "output";
    }

    protected Path getTemporaryDirectory() {
        return temporaryDirectory;
    }

    protected EngineConfiguration getEngineConfiguration() {
        return new EngineConfiguration.Builder()
                .baseDir(getTemporaryDirectory()).buildDir(getBuildDirectory())
                .outputDir(getOutputDirectory()).withDefaultAnnotations()
                .build();
    }
}
