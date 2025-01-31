package com.vaadin.hilla.internal;

import com.vaadin.flow.server.frontend.FrontendUtils;
import com.vaadin.hilla.ApplicationContextProvider;
import com.vaadin.hilla.internal.fixtures.CustomEndpoint;
import com.vaadin.hilla.internal.fixtures.EndpointNoValue;
import com.vaadin.hilla.internal.fixtures.MyEndpoint;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.util.FileSystemUtils;

import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Stream;

@SpringBootTest(classes = { CustomEndpoint.class, EndpointNoValue.class,
        MyEndpoint.class, ApplicationContextProvider.class })
public class EndpointsTaskTest extends TaskTest {

    static private Path npmDependenciesTempDirectory;

    @BeforeAll
    public static void setupNpmDependencies()
            throws IOException, FrontendUtils.CommandExecutionException,
            InterruptedException, URISyntaxException {
        npmDependenciesTempDirectory = Files
                .createTempDirectory(EndpointsTaskTest.class.getName());

        Path packagesPath = Path
                .of(Objects.requireNonNull(EndpointsTaskTest.class
                        .getClassLoader().getResource("")).toURI())
                .getParent() // target
                .getParent() // engine-runtime
                .getParent() // java
                .getParent(); // packages

        Path projectRoot = packagesPath.getParent();
        Files.copy(projectRoot.resolve(".npmrc"),
                npmDependenciesTempDirectory.resolve(".npmrc"));
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
                .directory(npmDependenciesTempDirectory.toFile())
                .redirectOutput(ProcessBuilder.Redirect.INHERIT)
                .redirectError(ProcessBuilder.Redirect.INHERIT);
        var exitCode = processBuilder.start().waitFor();
        if (exitCode != 0) {
            throw new FrontendUtils.CommandExecutionException(exitCode);
        }
    }

    @BeforeEach
    public void copyNpmDependencies() throws IOException {
        FileSystemUtils.copyRecursively(npmDependenciesTempDirectory,
                getTemporaryDirectory());
    }
}
