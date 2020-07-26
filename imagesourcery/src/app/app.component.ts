import {ChangeDetectorRef, Component, HostListener, OnInit} from '@angular/core';
import {ElectronService} from 'ngx-electron'

export enum KEY_CODE {
  RIGHT_ARROW = 39,
  LEFT_ARROW = 37
}

interface ClassDescription {
  cl: string;
  digit: number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'imagesourcery';
  selectedSourcePath: string = null;
  selectedTargetPath: string = null;
  newClass: string;
  classes: ClassDescription[] = [];
  files: string[] = [];
  current: number = 0;
  currentFileData: string;
  private digitToClass: Map<number, string> = new Map<number, string>();
  private currentClass = 1;
  version: string;
  notificationMessage: string;
  notificationOpened: boolean;
  restartAvailable: boolean;

  constructor(private _electronService: ElectronService, private changeDetection: ChangeDetectorRef) {

  }

  ngOnInit() {
    var self = this;
    this._electronService.ipcRenderer.send('app_version');
    this._electronService.ipcRenderer.on('app_version', (event, arg) => {
      this._electronService.ipcRenderer.removeAllListeners('app_version');
      self.version = 'Version ' + arg.version;
      self.changeDetection.detectChanges();
    });

    this._electronService.ipcRenderer.on('update_available', () => {
      console.log('got update_available in renderer');
      this._electronService.ipcRenderer.removeAllListeners('update_available');
      this.notificationMessage = 'A new update is available. Downloading now...';
      this.notificationOpened = true;
    });

    this._electronService.ipcRenderer.on('update_downloaded', () => {
      console.log('got update_downloaded in renderer');
      this._electronService.ipcRenderer.removeAllListeners('update_downloaded');
      this.notificationMessage = 'Update Downloaded. It will be installed on restart. Restart now?';
      this.restartAvailable = true;
      this.notificationOpened = true;
    });
  }

  @HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
    if (event.keyCode === KEY_CODE.RIGHT_ARROW) {
      this.next();
    }

    if (event.keyCode === KEY_CODE.LEFT_ARROW) {
      this.prev();
    }

    // digits
    let possibleDigit = event.keyCode - 48;
    if (possibleDigit >=1 && possibleDigit <= 9) {
      this.assignNumeric(possibleDigit);
    }
  }

  selectSourceDir() {
    const paths = this._electronService.remote.dialog.showOpenDialogSync({properties: ['openDirectory']});
    if (paths != null && paths.length > 0) {
      this.selectedSourcePath = paths[0];
      const files = this._electronService.ipcRenderer.sendSync('list-dir', this.selectedSourcePath);
      this.files = files;
      this.getCurrentImage();
    }
  }

  selectTargetDir() {
    const paths = this._electronService.remote.dialog.showOpenDialogSync({properties: ['openDirectory']});
    if (paths != null && paths.length > 0) {
      this.selectedTargetPath = paths[0];
    }
    setTimeout(() => { this.notificationOpened = true; }, 1000)
  }

  addClass() {
    if (this.newClass == null) {
      return;
    }
    const trimmedClass = this.newClass.trim();
    if (trimmedClass.length !== 0) {
      this.classes.push({cl: trimmedClass, digit: this.currentClass});
      this.digitToClass.set(this.currentClass, trimmedClass);
      this.currentClass += 1;
      this.newClass = '';
    }
  }

  assign(cl: string) {
    if (this.files == null || this.files.length == 0 ) {
      return;
    }
    console.log(`Pressed ${cl}`);
    this._electronService.ipcRenderer.sendSync('move-file', {
      cl: cl,
      sourceDir: this.selectedSourcePath,
      targetDir: this.selectedTargetPath,
      file: this.files[this.current]
    });
    const files = this._electronService.ipcRenderer.sendSync('list-dir', this.selectedSourcePath);
    this.files = files;
    if (this.current == this.files.length && this.current != 0) {
      this.current = this.files.length - 1;
    }
    this.getCurrentImage();
  }

  private getCurrentImage() {
    if (this.files.length !== 0) {
      let currentFile = this.files[this.current];
      const data = this._electronService.ipcRenderer.sendSync('get-file', {
        dir: this.selectedSourcePath,
        file: currentFile
      });
      let fileComponents = currentFile.split(".");
      let type = fileComponents[fileComponents.length-1];
      if (['jpg', 'jpeg', 'png'].indexOf(type.toLowerCase()) != -1) {
        this.currentFileData = `data:image/${type};base64,${data}`;
      } else {
        this.currentFileData = null;
      }
    } else {
      this.currentFileData = null;
    }
  }

  prev() {
    console.log(`Pressed prev`);
    if (this.current == 0) {
      this.current = this.files.length - 1;
    } else {
      this.current = this.current - 1;
    }
    this.getCurrentImage();
  }

  next() {
    console.log(`Pressed next`);
    if (this.current == this.files.length - 1) {
      this.current = 0;
    } else {
      this.current = this.current + 1;
    }

    this.getCurrentImage();
  }

  hasBothDirs() {
    return this.selectedSourcePath !== null && this.selectedTargetPath !== null;
  }

  private assignNumeric(possibleDigit: number) {
    let cl = this.digitToClass.get(possibleDigit);
    if (cl != null) {
      this.assign(cl);
    }
  }

  closeNotification() {
    this.notificationOpened = false;
  }

  restartApp() {
    this._electronService.ipcRenderer.send('restart_app');
  }
}
