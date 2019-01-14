import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';


export default class Server {

  constructor(directory, port, version) {
    this.port = port;
    this.directory = directory;
    this.version = version;
    this.base = `http://localhost:${port}/v${version}/`;
    this.app = express();
    this.app.use(cors());
    this.router = express.Router();
    this.$setRoutes();
    this.app.use(`/v${version}`, this.router);
    this.app.listen(this.port);
    console.log(`RestFS deployed on ${directory} via ${this.base}`);
  }

  $setRoutes() {
    this.$setListFiles();
    this.$setDeleteFile();
    this.$setDownloadFile();
    this.$setUploadFile();
  }

  $setListFiles() {
    this.router.route('/files').get((req, res) => {
      console.log('request files list');
      res.json(
        fs.readdirSync(this.directory)
          .map((element) => {
          const file = fs.statSync(path.join(this.directory, element));
          return {
            name: element,
            size: file.size,
            modified: file.mtime,
            isFile: file.isFile(),
          };
        })
      );
    });
  }

  $setDeleteFile() {
    const self = this;
    self.router.route('/files').delete((req, res) => {
      const filePath = req.get('RFS-arg-path');
      console.log(`request delete ${filePath}`);
      if (!filePath) {
        console.log('error on file delete parameters');
        res.status(204).json({error: 'cannot get path to delete file'});
      } else {
        const file = path.join(self.directory, filePath);
        if (fs.existsSync(file)) {
          const statSync = fs.statSync(file);
          if (statSync.isFile()) {
            fs.unlinkSync(file);
            console.log(`success 200 ${filePath} deleted`);
            res.status(200).json({status: 'ok'});
          } else {
            console.log('error 403 cannot delete a directory');
            res.status(403).json({error: 'cannot delete the given file'});
          }
        } else {
          console.log('error 404 file not found');
          res.status(404).json({error: 'file not found'});
        }
      }
    });
  }

  $setDownloadFile() {
    const self = this;
    self.router.route('/files/download').get((req, res) => {
      const file = req.get('RFS-arg-path');
      console.log(`request download ${file}`);
      if (!file) {
        console.log('error 404 bad file download parameters');
        res.status(404).json({error: 'cannot get path to download file'});
      } else {
        const filePath = path.normalize(path.join(self.directory, file));
        if (fs.existsSync(filePath)) {
          const statSync = fs.statSync(filePath);
          res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': statSync.size,
          });
          const readStream = fs.createReadStream(filePath);
          readStream.pipe(res);
        } else {
          console.log('error 404 file not found');
          res.status(404).json({error: 'file not found'});
        }
      }
    });
  }

  $setUploadFile() {
    const self = this;
    self.router.route('/files/upload').put((req, res) => {
      const file = req.get('RFS-arg-path');
      console.log(`request upload ${file}`);
      if (!file) {
        console.log('error on file upload parameters');
        res.status(400).json({error: 'cannot get the name of the file to upload'});
      } else {
        const filePath = path.normalize(path.join(self.directory, file));
        try {
          const writeStream = fs.createWriteStream(filePath, {
            'defaultEncoding': 'binary',
          });
          req.on('data', (chunk) => {
            writeStream.write(chunk);
          });
          req.on('end', () => {
            writeStream.end();
            console.log(`finished upload ${file}`);
            res.status(201).json({status: 'ok'});
            res.end();
          });
        } catch(err) {
          console.log('error 403 bad path');
          res.status(403).json({error: 'path is not correct'});
        }
      }
    });
  }
}
