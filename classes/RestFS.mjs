import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';


export default class Server {

  constructor(directory, port, version) {
    this.port = port;
    this.directory = directory;
    this.version = version;
    this.uploading = {};
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
    this._setListFiles();
    this._setDeleteFile();
    this._setDownloadFile();
    this._setUploadFile();
    this._setUploadChunk();
  }

  _setListFiles() {
    const self = this;
    self.router.route('/files').get((req, res) => {
      console.log('request files list');
      res.json(
        fs.readdirSync(self.directory)
          .map((element) => {
          const file = fs.statSync(path.join(self.directory, element));
          return {
            id: element,
            name: element,
            size: file.size,
            modified: file.mtime,
            isFile: file.isFile(),
          };
        }).filter((element) => {
          return !self.uploading[element.id];
        }),
      );
    });
  }

  _setDeleteFile() {
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

  _setDownloadFile() {
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

  _setUploadFile() {
    const self = this;
    self.router.route('/files/upload').post((req, res) => {
      const file = req.get('rfs-arg-path');
      const size = parseInt(req.get('rfs-arg-size'));
      console.log(`request upload ${file}`);
      if (!file || !size) {
        console.log('error on file upload parameters');
        res.status(400).json({error: 'cannot get the name of the file to upload'});
      } else {
        const filePath = path.normalize(path.join(self.directory, file));
        try {
          const stream = fs.createWriteStream(filePath, {
            'defaultEncoding': 'binary',
            'encoding': 'binary',
          });
          const id = file;
          const position = 0;
          self.uploading[file] = {
            stream,
            size,
            id,
            position,
            name: file,
          };
          stream.on('open', () => {
            console.log(`registered upload ${id}`);
            res.status(201).json({ id, position });
            res.end();
          });
        } catch(err) {
          console.error(err);
          res.status(403).json({error: 'path is not correct'});
        }
      }
    });
  }

  _setUploadChunk() {
    const self = this;
    self.router.route('/files/upload').put((req, res) => {
      const id = req.get('rfs-arg-id');
      console.log(`upload chunk for ${id}`);
      if (!self.uploading[id]) {
        console.log(`error unknown file parameters ${id}`);
        res.status(400).json({error: 'File was not registered before uploading chunks'});
      } else {
        try {
          req.on('data', (data) => {
            self.uploading[id].stream.write(data);
            self.uploading[id].position += data.length;
          });
          req.on('error', (error) => {
            console.error(error);
            res.status(403).json({error: `error uploading chunk for file ${id}`});
            res.end();
          });
          req.on('end', () => {
            if (self.uploading[id].position >= self.uploading[id].size) {
              self.uploading[id].stream.close();
              delete self.uploading[id];
              res.status(201).json({status: 'done'});
            } else if (self.uploading[id].position < self.uploading[id].size) {
              res.status(200).json({status: 'ok', position: self.uploading[id].position, id});
            } else {
              res.status(403).json({error: `error uploading chunk for file ${id}`});
            }
            res.end();
          });
        } catch(err) {
          console.error(error);
          res.status(403).json({error: `error uploading chunk for file ${id}`});
        }
      }
    });
  }
}
