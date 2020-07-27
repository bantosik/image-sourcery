const {app, BrowserWindow, ipcMain} = require('electron')
const url = require("url");
const path = require("path");
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

log.transports.file.level = 'info';

let mainWindow

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  })

  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, `/dist/app/index.html`),
      protocol: "file:",
      slashes: true
    })
  );
  // Open the DevTools.
  mainWindow.webContents.openDevTools()

  mainWindow.on('closed', function () {
    mainWindow = null
  });

  mainWindow.once('ready-to-show', () => {
    log.info('ready-to-show checking for updates');
    autoUpdater.checkForUpdatesAndNotify().then(
      (x) => {
        log.info('Got updates ' + JSON.stringify(x));
      }
    );
  });
}

app.on('ready', createWindow)

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  if (mainWindow === null) createWindow()
})


ipcMain.on('list-dir', function (event, data) {
  fs.readdir(data, function(err, dir) {
    event.returnValue = dir;
  });
})

ipcMain.on('move-file', function (event, data) {
  const sourceDir = data.sourceDir;
  const targetDir = data.targetDir;
  const cl = data.cl;
  const file = data.file;

  let classDir = path.join(targetDir, cl);
  if (!fs.existsSync(classDir)){
    fs.mkdirSync(classDir);
  }
  let sourceFile = path.join(sourceDir, file);
  let targetFile = path.join(classDir, file);

  fs.renameSync(sourceFile, targetFile);
  event.returnValue = 0;
})

ipcMain.on("get-file", (event, arg) => {
  const dir = arg.dir;
  const file = arg.file;
  const filePath = path.join(dir, file);
  console.log(filePath);
  const base64 = fs.readFileSync(filePath).toString('base64');
  event.returnValue = base64;
});

ipcMain.on('app_version', (event) => {
  event.sender.send('app_version', { version: app.getVersion() });
});

ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});

autoUpdater.on('update-available', () => {
  log.info('Got update-available in main process');
  mainWindow.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', () => {
  log.info('Got update-downloaded in main process');
  mainWindow.webContents.send('update_downloaded');
});
