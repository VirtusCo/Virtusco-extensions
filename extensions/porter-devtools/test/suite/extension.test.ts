import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    test('Extension should be present', () => {
        const ext = vscode.extensions.getExtension('virtusco.porter-devtools');
        assert.ok(ext, 'Extension not found');
    });

    test('Extension should activate on view open', async () => {
        await vscode.commands.executeCommand('workbench.view.extension.porter-robot');
        const ext = vscode.extensions.getExtension('virtusco.porter-devtools');
        assert.ok(ext, 'Extension not found');
        // Wait for activation
        if (ext && !ext.isActive) {
            await ext.activate();
        }
        assert.ok(ext?.isActive, 'Extension not active');
    });

    test('All commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        const porterCommands = commands.filter(c => c.startsWith('porterRobot.'));

        const expectedCommands = [
            'porterRobot.refreshDevices',
            'porterRobot.identifyDevice',
            'porterRobot.configureRpi',
            'porterRobot.refreshReleases',
            'porterRobot.downloadArtifact',
            'porterRobot.downloadAllArtifacts',
            'porterRobot.flashMotorController',
            'porterRobot.flashSensorFusion',
            'porterRobot.flashCustom',
            'porterRobot.westFlashMotor',
            'porterRobot.westFlashSensor',
            'porterRobot.selectFlashMode',
            'porterRobot.deployDocker',
            'porterRobot.deployFlutterGui',
            'porterRobot.openSerialMonitor',
            'porterRobot.closeSerialMonitor',
            'porterRobot.verifyChecksums',
        ];

        for (const cmd of expectedCommands) {
            assert.ok(
                porterCommands.includes(cmd),
                `Command ${cmd} not registered`,
            );
        }
    });
});
