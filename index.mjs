import fs from 'fs';
import path from 'path';
import Mkdirp from 'mkdirp';
import ArgParse from 'argparse';

import RestFS from './classes/RestFS';

const Package = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

function run(args) {
  const mainVersion = Package.version.split('.')[0];
  for (let k = 0; k < args.number; k++) {
    const port = args.port + k;
    const subDirectory = path.join(args.directory, port.toString());
    Mkdirp(subDirectory, () =>  new RestFS(subDirectory, port, mainVersion));
  }
}

/**
 * Command line parser
 */
const parser = new ArgParse.ArgumentParser({
  version: Package.version,
  addHelp: true,
  description: Package.description
});
parser.addArgument(['-n', '--number'], {
  help: 'number of RESTful server API to instantiate',
  defaultValue: 1,
  type: 'int',
  choices: [...Array(16).keys()].slice(1)
});
parser.addArgument(['-p', '--port'], {
  help: 'base port to use for servers and increment for each other server',
  defaultValue: 9000,
  type: 'int'
});
parser.addArgument(['-d', '--directory'], {
  help: 'base directory for servers file systems',
  defaultValue: path.join(path.dirname(new URL(import.meta.url).pathname), 'local_storage')
});
run(parser.parseArgs());
