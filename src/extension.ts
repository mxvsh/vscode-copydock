import * as vscode from "vscode";
import * as ws from "ws";
let lastUserId = "";

const websocket = new ws("https://copydock.herokuapp.com/");
const userIdStatus = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Right,
  9900
);
userIdStatus.text = "Waiting for ID...";
userIdStatus.color = "white";
userIdStatus.show();

// Websocket handlers
websocket.on("open", () => {
  console.log("[CopyDock] connected to websocket");
});
websocket.on("error", () => {
  websocket.close();
  vscode.window.showErrorMessage("Disconnected from CopyDock");
});
websocket.on("close", () => {
  userIdStatus.text = "Disconnected";
  vscode.window.showErrorMessage("Disconnected from CopyDock");
});

export function activate(context: vscode.ExtensionContext) {
  vscode.commands.registerTextEditorCommand(
    "copydock.handleResponse",
    async () => {
      websocket.on("message", async (wsdata: string) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }
        let selection = editor.selection;
        if (!selection) {
          return;
        }

        try {
          let { type, payload } = JSON.parse(wsdata);

          switch (type) {
            case "user-id":
              userIdStatus.tooltip = `Share "${payload}" with your friend`;
              userIdStatus.text = `ID: ${payload}`;
              break;

            case "user-code":
              editor.edit((builder) => {
                builder.replace(selection, payload);
              });
              break;

            case "error":
              vscode.window.showErrorMessage(payload);
              break;
          }
        } catch (e) {
          console.log(`[copydock] error parsing data`);
        }
      });
    }
  );

  vscode.commands.executeCommand("copydock.handleResponse");

  let disposable = vscode.commands.registerTextEditorCommand(
    "copydock.sendCode",
    async () => {
      const workbenchConfig = vscode.workspace.getConfiguration();
      const settings: any = workbenchConfig.get("copyDock");

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return; // No open text editor
      }

      const selection = editor.selection;
      const text = editor.document.getText(selection);

      const otherUserId = await vscode.window.showInputBox({
        title: "Enter User ID",
        value: settings.useLastUserId ? lastUserId : "",
      });

      lastUserId = String(otherUserId); // "cache" the last entered user id
      const data = {
        otherUserId,
        text,
      };
      websocket.send(JSON.stringify(data));
    }
  );

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
