import { IncomingMessage } from 'http';
import https from 'https';
import zlib from 'zlib';

// https://www.whatismybrowser.com/guides/the-latest-user-agent/chrome
const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.105 Safari/537.36';

// https://en.wikipedia.org/wiki/Tar_(computing)#Header
const linkIndicators = { 'g': 'header', 0: 'file', 5: 'directory' };

void async function main() {
  const userName = 'TomasHubelbauer';
  const repositoryName = 'webrtc-data-channel-demo';

  // https://docs.github.com/en/rest/reference/repos#download-a-repository-archive
  const { headers: { location } } = await get(`https://api.github.com/repos/${userName}/${repositoryName}/tarball`);
  const response = await get(location);
  const buffer = await scrape(response);

  const data = await free(buffer);

  // TODO: Handle file entries whose name is not the full relative path but just the name - prepend with last directory?
  for await (const entry of parse(data)) {
    console.log(entry.fileName, linkIndicators[entry.linkIndicator] || entry.linkIndicator);
  }
}()

/**
 * @param {string} url
 * @returns {IncomingMessage}
 */
async function get(url) {
  return new Promise((resolve, reject) => https.get(url, { headers: { 'User-Agent': userAgent } }, resolve).on('error', reject));
}

async function scrape(/** @type {IncomingMessage} */ response) {
  return new Promise(async (resolve, reject) => {
    response.on('error', reject);

    /** @type {Buffer[]} */
    const buffers = [];

    for await (const chunk of response) {
      buffers.push(chunk);
    }

    resolve(Buffer.concat(buffers));
  });
}

/**
 * Decompresses the given buffer using zlib
 * @param {Buffer} buffer 
 */
async function free(buffer) {
  return new Promise((resolve, reject) => zlib.gunzip(buffer, (error, result) => error ? reject(error) : resolve(result)));
}

/**
 * 
 * @param {Buffer} buffer 
 * @returns {AsyncIterableIterator<{ fileName: string; content: string; }>}
 */
async function* parse(/** @type {Buffer} */buffer) {
  let index = 0;

  // https://en.wikipedia.org/wiki/Tar_(computing)#Header
  do {
    const fileName = slice(buffer, index, index += 100);
    const fileMode = slice(buffer, index, index += 8, { number: true });
    const ownerUserId = slice(buffer, index, index += 8, { number: true });
    const groupUserId = slice(buffer, index, index += 8, { number: true });
    const fileSize = slice(buffer, index, index += 12, { base: 8 });
    const modificationTime = slice(buffer, index, index += 12, { number: true });
    const checksum = slice(buffer, index, index += 8, { number: true });
    const linkIndicator = slice(buffer, index, index += 1, { nul: false });
    const linkedFileName = slice(buffer, index, index += 100);
    const ustar = slice(buffer, index, index += 6);
    if (ustar !== 'ustar') {
      throw new Error('Expected the USTAR header format.');
    }

    const ustarVersion = slice(buffer, index, index += 2, { number: true, nul: false });
    if (ustarVersion !== 0) {
      throw new Error('Expected USTAR version 0.');
    }

    const ownerUserName = slice(buffer, index, index += 32);
    const ownerGroupName = slice(buffer, index, index += 32);
    const deviceMajor = slice(buffer, index, index += 8, { number: true });
    const deviceMinor = slice(buffer, index, index += 8, { number: true });
    const fileNamePrefix = slice(buffer, index, index += 155);
    const padding = slice(buffer, index, index += 12);
    if (padding !== '') {
      throw new Error('Expected empty padding until the end of the header 512 byte span.');
    }

    const content = slice(buffer, index, index += fileSize, { nul: false });
    if (fileSize > 0) {
      const padding = slice(buffer, index, index += (512 - (fileSize % 512)));
      if (padding !== '') {
        throw new Error('Expected empty padding until the end of the content 512-multiple byte span.');
      }
    }


    yield ({
      fileName,
      fileMode,
      ownerUserId,
      groupUserId,
      fileSize,
      modificationTime,
      checksum,
      linkIndicator,
      linkedFileName,
      ownerUserName,
      ownerGroupName,
      deviceMajor,
      deviceMinor,
      fileNamePrefix,
      content,
    });
  }

  // TODO: Find a better way of detecting the end-of-file padding than this!
  while (index <= buffer.length && slice(buffer, index, buffer.length) !== '');
}

function slice(/** @type {Buffer} */ buffer, /** @type {number} */ start, /** @type {number} */ end, options = { base: undefined, nul: true, number: false }) {
  const data = buffer.slice(start, end);
  if (options.nul && data[data.length - 1] !== 0x0) {
    throw new Error('Expected NUL byte at the end of the field value!');
  }

  const string = data.toString('ascii').replace(/\0/g, '');
  if (options.number || options.base) {
    return Number.parseInt(string, options.base);
  }

  return string;
}
