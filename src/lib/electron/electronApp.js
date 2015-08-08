var app = require('app');  // Module to control application life.
var BrowserWindow = require('browser-window');  // Module to create native browser window.
var ipc = require('ipc');
var dialog = require('dialog');


// Report crashes to our server.
require('crash-reporter').start();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
var mainWindow = null;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  // On OSX it is common for applications and their menu bar 
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform != 'darwin') {
    app.quit();
  }
});

// This method will be called when Electron has done everything
// initialization and ready for creating browser windows.
app.on('ready', function() {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 1024, height: 768});

  // and load the index.html of the app.
  var url = process.env.DEV_MODE 
    ? 'http://localhost:3000'
    : 'file://' + __dirname + '/index.html';

  mainWindow.loadUrl(url);

  // Open the devtools.
  // mainWindow.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
});


var FILTERS = [
  { name: 'Heartnotes diary files', extensions: ['heartnotes'] },
];

ipc.on('synchronous-message', function(event, arg) {
  switch (arg) {

    case 'openFile':
      console.log('Choose file');

      try {
        event.returnValue = dialog.showOpenDialog(mainWindow, { 
          title: 'Open diary',
          properties: [ 
            'openFile', 
          ],
          filters: FILTERS,
        });
      } catch (err) {
        console.error(err);

        event.returnValue = null;
      }

      break;

    case 'saveNewFile':
      console.log('Choose file');

      try {
        event.returnValue = dialog.showSaveDialog(mainWindow, { 
          title: 'Create new diary',
          filters: FILTERS,
        });
      } catch (err) {
        console.error(err);

        event.returnValue = null;
      }

      break;
  }
});
