// node_modules/spessasynth_core/dist/index.js
function readBigEndian(dataArray, bytesAmount, offset = 0) {
  let out = 0;
  for (let i = 0; i < bytesAmount; i++) out = out << 8 | dataArray[offset + i];
  return out >>> 0;
}
function readBigEndianIndexed(dataArray, bytesAmount) {
  const res = readBigEndian(dataArray, bytesAmount, dataArray.currentIndex);
  dataArray.currentIndex += bytesAmount;
  return res;
}
function writeBigEndian(number, bytesAmount) {
  const bytes = new Array(bytesAmount).fill(0);
  for (let i = bytesAmount - 1; i >= 0; i--) {
    bytes[i] = number & 255;
    number >>= 8;
  }
  return bytes;
}
function readLittleEndianIndexed(dataArray, bytesAmount) {
  const res = readLittleEndian(dataArray, bytesAmount, dataArray.currentIndex);
  dataArray.currentIndex += bytesAmount;
  return res;
}
function readLittleEndian(dataArray, bytesAmount, offset = 0) {
  let out = 0;
  for (let i = 0; i < bytesAmount; i++) out |= dataArray[offset + i] << i * 8;
  return out >>> 0;
}
function writeLittleEndianIndexed(dataArray, number, byteTarget) {
  for (let i = 0; i < byteTarget; i++) dataArray[dataArray.currentIndex++] = number >> i * 8 & 255;
}
function writeWord(dataArray, word) {
  dataArray[dataArray.currentIndex++] = word & 255;
  dataArray[dataArray.currentIndex++] = word >> 8;
}
function writeDword(dataArray, dword) {
  writeLittleEndianIndexed(dataArray, dword, 4);
}
function signedInt16(byte1, byte2) {
  const val = byte2 << 8 | byte1;
  if (val > 32767) return val - 65536;
  return val;
}
function signedInt8(byte) {
  if (byte > 127) return byte - 256;
  return byte;
}
var IndexedByteArray = class extends Uint8Array {
  /**
  * The current index of the array.
  */
  currentIndex = 0;
  /**
  * Returns a section of an array.
  * @param start The beginning of the specified portion of the array.
  * @param end The end of the specified portion of the array. This is exclusive of the element at the index 'end'.
  */
  slice(start, end) {
    const a = super.slice(start, end);
    a.currentIndex = 0;
    return a;
  }
};
function readBinaryString(dataArray, bytes = dataArray.length, offset = 0) {
  let string = "";
  for (let i = 0; i < bytes; i++) {
    const byte = dataArray[offset + i];
    if (byte === 0) return string;
    string += String.fromCharCode(byte);
  }
  return string;
}
function readBinaryStringIndexed(dataArray, bytes) {
  const startIndex = dataArray.currentIndex;
  dataArray.currentIndex += bytes;
  return readBinaryString(dataArray, bytes, startIndex);
}
function getStringBytes(string, addZero = false, ensureEven = false) {
  let len = string.length;
  if (addZero) len++;
  if (ensureEven && len % 2 !== 0) len++;
  const arr = new IndexedByteArray(len);
  writeBinaryStringIndexed(arr, string);
  return arr;
}
function writeBinaryStringIndexed(outArray, string, padLength = 0) {
  if (padLength > 0 && string.length > padLength) string = string.slice(0, padLength);
  for (let i = 0; i < string.length; i++) outArray[outArray.currentIndex++] = string.charCodeAt(i);
  if (padLength > string.length) for (let i = 0; i < padLength - string.length; i++) outArray[outArray.currentIndex++] = 0;
  return outArray;
}
function readVariableLengthQuantity(midiByteArray) {
  let out = 0;
  while (midiByteArray) {
    const byte = midiByteArray[midiByteArray.currentIndex++];
    out = out << 7 | byte & 127;
    if (byte >> 7 !== 1) break;
  }
  return out;
}
function writeVariableLengthQuantity(number) {
  const bytes = [number & 127];
  number >>= 7;
  while (number > 0) {
    bytes.unshift(number & 127 | 128);
    number >>= 7;
  }
  return bytes;
}
function formatTime(totalSeconds) {
  totalSeconds = Math.floor(totalSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds - minutes * 60);
  return {
    minutes,
    seconds,
    time: `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  };
}
function arrayToHexString(arr) {
  let hexString = "";
  for (let i = 0; i < arr.length; i++) {
    const hex = arr[i].toString(16).padStart(2, "0").toUpperCase();
    hexString += hex;
    if (i < arr.length - 1) hexString += " ";
  }
  return hexString;
}
var ConsoleColors = {
  warn: "color: orange;",
  unrecognized: "color: red;",
  info: "color: aqua;",
  recognized: "color: lime",
  value: "color: yellow; background-color: black;"
};
var tr;
(() => {
  var l = Uint8Array, T = Uint16Array, ur = Int32Array, W = new l([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    0,
    0,
    0,
    0
  ]), X = new l([
    0,
    0,
    0,
    0,
    1,
    1,
    2,
    2,
    3,
    3,
    4,
    4,
    5,
    5,
    6,
    6,
    7,
    7,
    8,
    8,
    9,
    9,
    10,
    10,
    11,
    11,
    12,
    12,
    13,
    13,
    0,
    0
  ]), wr = new l([
    16,
    17,
    18,
    0,
    8,
    7,
    9,
    6,
    10,
    5,
    11,
    4,
    12,
    3,
    13,
    2,
    14,
    1,
    15
  ]), Y = function(r, a) {
    for (var e = new T(31), f = 0; f < 31; ++f) e[f] = a += 1 << r[f - 1];
    for (var v = new ur(e[30]), f = 1; f < 30; ++f) for (var g = e[f]; g < e[f + 1]; ++g) v[g] = g - e[f] << 5 | f;
    return {
      b: e,
      r: v
    };
  }, Z = Y(W, 2), $ = Z.b, cr = Z.r;
  $[28] = 258, cr[258] = 28;
  var j = Y(X, 0), hr = j.b;
  j.r;
  var _ = new T(32768);
  for (i = 0; i < 32768; ++i) c = (i & 43690) >> 1 | (i & 21845) << 1, c = (c & 52428) >> 2 | (c & 13107) << 2, c = (c & 61680) >> 4 | (c & 3855) << 4, _[i] = ((c & 65280) >> 8 | (c & 255) << 8) >> 1;
  var c, i, A = function(r, a, e) {
    for (var f = r.length, v = 0, g = new T(a); v < f; ++v) r[v] && ++g[r[v] - 1];
    var k = new T(a);
    for (v = 1; v < a; ++v) k[v] = k[v - 1] + g[v - 1] << 1;
    var b;
    if (e) {
      b = new T(1 << a);
      var m = 15 - a;
      for (v = 0; v < f; ++v) if (r[v]) for (var U = v << 4 | r[v], x = a - r[v], n = k[r[v] - 1]++ << x, o = n | (1 << x) - 1; n <= o; ++n) b[_[n] >> m] = U;
    } else for (b = new T(f), v = 0; v < f; ++v) r[v] && (b[v] = _[k[r[v] - 1]++] >> 15 - r[v]);
    return b;
  }, M = new l(288);
  for (i = 0; i < 144; ++i) M[i] = 8;
  var i;
  for (i = 144; i < 256; ++i) M[i] = 9;
  var i;
  for (i = 256; i < 280; ++i) M[i] = 7;
  var i;
  for (i = 280; i < 288; ++i) M[i] = 8;
  var i, L = new l(32);
  for (i = 0; i < 32; ++i) L[i] = 5;
  var i, gr = A(M, 9, 1), br = A(L, 5, 1), q = function(r) {
    for (var a = r[0], e = 1; e < r.length; ++e) r[e] > a && (a = r[e]);
    return a;
  }, u = function(r, a, e) {
    var f = a / 8 | 0;
    return (r[f] | r[f + 1] << 8) >> (a & 7) & e;
  }, C = function(r, a) {
    var e = a / 8 | 0;
    return (r[e] | r[e + 1] << 8 | r[e + 2] << 16) >> (a & 7);
  }, kr = function(r) {
    return (r + 7) / 8 | 0;
  }, xr = function(r, a, e) {
    return (a == null || a < 0) && (a = 0), (e == null || e > r.length) && (e = r.length), new l(r.subarray(a, e));
  }, yr = [
    "unexpected EOF",
    "invalid block type",
    "invalid length/literal",
    "invalid distance",
    "stream finished",
    "no stream handler",
    ,
    "no callback",
    "invalid UTF-8 data",
    "extra field too long",
    "date not in range 1980-2099",
    "filename too long",
    "stream finishing",
    "invalid zip data"
  ], h = function(r, a, e) {
    var f = new Error(a || yr[r]);
    if (f.code = r, Error.captureStackTrace && Error.captureStackTrace(f, h), !e) throw f;
    return f;
  }, Sr = function(r, a, e, f) {
    var v = r.length, g = f ? f.length : 0;
    if (!v || a.f && !a.l) return e || new l(0);
    var k = !e, b = k || a.i != 2, m = a.i;
    k && (e = new l(v * 3));
    var U = function(fr) {
      var or = e.length;
      if (fr > or) {
        var lr = new l(Math.max(or * 2, fr));
        lr.set(e), e = lr;
      }
    }, x = a.f || 0, n = a.p || 0, o = a.b || 0, S = a.l, I = a.d, z = a.m, D = a.n, G = v * 8;
    do {
      if (!S) {
        x = u(r, n, 1);
        var H = u(r, n + 1, 3);
        if (n += 3, H) if (H == 1) S = gr, I = br, z = 9, D = 5;
        else if (H == 2) {
          var N = u(r, n, 31) + 257, s = u(r, n + 10, 15) + 4, d = N + u(r, n + 5, 31) + 1;
          n += 14;
          for (var F = new l(d), P = new l(19), t = 0; t < s; ++t) P[wr[t]] = u(r, n + t * 3, 7);
          n += s * 3;
          for (var rr = q(P), Ar = (1 << rr) - 1, Mr = A(P, rr, 1), t = 0; t < d; ) {
            var ar = Mr[u(r, n, Ar)];
            n += ar & 15;
            var w = ar >> 4;
            if (w < 16) F[t++] = w;
            else {
              var E = 0, O = 0;
              for (w == 16 ? (O = 3 + u(r, n, 3), n += 2, E = F[t - 1]) : w == 17 ? (O = 3 + u(r, n, 7), n += 3) : w == 18 && (O = 11 + u(r, n, 127), n += 7); O--; ) F[t++] = E;
            }
          }
          var er = F.subarray(0, N), y = F.subarray(N);
          z = q(er), D = q(y), S = A(er, z, 1), I = A(y, D, 1);
        } else h(1);
        else {
          var w = kr(n) + 4, J = r[w - 4] | r[w - 3] << 8, K = w + J;
          if (K > v) {
            m && h(0);
            break;
          }
          b && U(o + J), e.set(r.subarray(w, K), o), a.b = o += J, a.p = n = K * 8, a.f = x;
          continue;
        }
        if (n > G) {
          m && h(0);
          break;
        }
      }
      b && U(o + 131072);
      for (var Ur = (1 << z) - 1, zr = (1 << D) - 1, Q = n; ; Q = n) {
        var E = S[C(r, n) & Ur], p = E >> 4;
        if (n += E & 15, n > G) {
          m && h(0);
          break;
        }
        if (E || h(2), p < 256) e[o++] = p;
        else if (p == 256) {
          Q = n, S = null;
          break;
        } else {
          var nr = p - 254;
          if (p > 264) {
            var t = p - 257, B = W[t];
            nr = u(r, n, (1 << B) - 1) + $[t], n += B;
          }
          var R = I[C(r, n) & zr], V = R >> 4;
          R || h(3), n += R & 15;
          var y = hr[V];
          if (V > 3) {
            var B = X[V];
            y += C(r, n) & (1 << B) - 1, n += B;
          }
          if (n > G) {
            m && h(0);
            break;
          }
          b && U(o + 131072);
          var vr = o + nr;
          if (o < y) {
            var ir = g - y, Dr = Math.min(y, vr);
            for (ir + o < 0 && h(3); o < Dr; ++o) e[o] = f[ir + o];
          }
          for (; o < vr; ++o) e[o] = e[o - y];
        }
      }
      a.l = S, a.p = Q, a.b = o, a.f = x, S && (x = 1, a.m = z, a.d = I, a.n = D);
    } while (!x);
    return o != e.length && k ? xr(e, 0, o) : e.subarray(0, o);
  }, Tr = new l(0);
  function mr(r, a) {
    return Sr(r, { i: 2 }, a && a.out, a && a.dictionary);
  }
  var Er = typeof TextDecoder < "u" && new TextDecoder();
  try {
    Er.decode(Tr, { stream: true });
  } catch {
  }
  tr = mr;
})();
var inf = tr;
var RIFFChunk = class RIFFChunk2 {
  /**
  * The chunks FourCC code.
  */
  header;
  /**
  * Chunk's size, in bytes.
  */
  size;
  /**
  * Chunk's binary data. Note that this will have a length of 0 if "readData" was set to false.
  */
  data;
  /**
  * Creates a new RIFF chunk.
  */
  constructor(header, size, data) {
    this.header = header;
    this.size = size;
    this.data = data;
  }
  /**
  * Reads a RIFF chunk from an array.
  * @param dataArray the array to read from.
  * @param readData if the data should be read as well.
  * @param forceShift if the index should be shifted to the end of the chunk even if the data has not been read.
  */
  static read(dataArray, readData = true, forceShift = false) {
    const header = readBinaryStringIndexed(dataArray, 4);
    let size = readLittleEndianIndexed(dataArray, 4);
    if (header === "") size = 0;
    const chunkData = readData ? dataArray.slice(dataArray.currentIndex, dataArray.currentIndex + size) : new IndexedByteArray(0);
    if (readData || forceShift) {
      dataArray.currentIndex += size;
      if (size % 2 !== 0) dataArray.currentIndex++;
    }
    return new RIFFChunk2(header, size, chunkData);
  }
  /**
  * Writes a RIFF chunk correctly.
  * @param header the fourCC code of the header.
  * @param data the binary chunk data.
  * @param addZeroByte if a zero byte should be at the end of the chunk's data.
  * @param isList if a "LIST" should be set as the chunk type and the actual type should be written at the start of the data.
  * @returns the binary data.
  */
  static write(header, data, addZeroByte = false, isList = false) {
    if (header.length !== 4) throw new Error(`Invalid header length: ${header}`);
    let dataStartOffset = 8;
    let headerWritten = header;
    let dataLength = data.length;
    if (addZeroByte) dataLength++;
    let writtenSize = dataLength;
    if (isList) {
      dataStartOffset += 4;
      writtenSize += 4;
      headerWritten = "LIST";
    }
    let finalSize = dataStartOffset + dataLength;
    if (finalSize % 2 !== 0) finalSize++;
    const outArray = new IndexedByteArray(finalSize);
    writeBinaryStringIndexed(outArray, headerWritten);
    writeDword(outArray, writtenSize);
    if (isList) writeBinaryStringIndexed(outArray, header);
    outArray.set(data, dataStartOffset);
    return outArray;
  }
  /**
  * "Writes" a RIFF chunk as a list of binary blobs,
  * which can be appended to a list without using more memory,
  * then finally allocated at the end with `writeParts`.
  * This allows avoiding large array allocations and only one writeParts call at the end.
  * @param header  the fourCC code of the header.
  * @param chunks binary chunk data parts, will be combined in order.
  * @param isList if a "LIST" should be set as the chunk type and the actual type should be written at the start of the data.
  * @returns the chunk as binary blobs.
  */
  static getParts(header, chunks, isList = false) {
    let headerWritten = header;
    let totalSize = chunks.reduce((len, c) => c.length + len, 0);
    if (isList) {
      totalSize += 4;
      headerWritten = "LIST";
    }
    const dwordSize = new IndexedByteArray(4);
    writeDword(dwordSize, totalSize);
    const parts = [getStringBytes(headerWritten), dwordSize];
    if (isList) parts.push(getStringBytes(header));
    parts.push(...chunks);
    if (totalSize % 2 !== 0) parts.push(new Uint8Array(1));
    return parts;
  }
  /**
  * Writes RIFF chunk given binary blobs.
  * It merges them together into data and allocates one large array.
  * @param header  the fourCC code of the header.
  * @param chunks binary chunk data parts, will be combined in order.
  * @param isList if a "LIST" should be set as the chunk type and the actual type should be written at the start of the data.
  * @returns the binary data.
  */
  static writeParts(header, chunks, isList = false) {
    let dataOffset = 8;
    let headerWritten = header;
    const dataLength = chunks.reduce((len, c) => c.length + len, 0);
    let writtenSize = dataLength;
    if (isList) {
      dataOffset += 4;
      writtenSize += 4;
      headerWritten = "LIST";
    }
    let finalSize = dataOffset + dataLength;
    if (finalSize % 2 !== 0) finalSize++;
    const outArray = new IndexedByteArray(finalSize);
    writeBinaryStringIndexed(outArray, headerWritten);
    writeDword(outArray, writtenSize);
    if (isList) writeBinaryStringIndexed(outArray, header);
    for (const c of chunks) {
      outArray.set(c, dataOffset);
      dataOffset += c.length;
    }
    return outArray;
  }
  /**
  * Finds a given type in a list.
  * @remarks
  * Also skips the current index to after the list FourCC.
  */
  static findListType(collection, type) {
    return collection.find((c) => {
      if (c.header !== "LIST") return false;
      c.data.currentIndex = 4;
      return readBinaryString(c.data, 4) === type;
    });
  }
};
function fillWithDefaults(obj, defObj) {
  return {
    ...defObj,
    ...obj
  };
}
var DEFAULT_WAV_WRITE_OPTIONS = {
  normalizeAudio: true,
  loop: void 0,
  metadata: {}
};
function audioToWav(audioData, sampleRate, options = DEFAULT_WAV_WRITE_OPTIONS) {
  const length = audioData[0].length;
  const numChannels = audioData.length;
  const bytesPerSample = 2;
  const fullOptions = fillWithDefaults(options, DEFAULT_WAV_WRITE_OPTIONS);
  const loop = fullOptions.loop;
  const metadata = fullOptions.metadata;
  let infoChunk = new IndexedByteArray(0);
  const infoOn = Object.keys(metadata).length > 0;
  if (infoOn) {
    const encoder = new TextEncoder();
    const infoChunks = [RIFFChunk.write("ICMT", encoder.encode("Created with SpessaSynth"), true)];
    if (metadata.artist) infoChunks.push(RIFFChunk.write("IART", encoder.encode(metadata.artist), true));
    if (metadata.album) infoChunks.push(RIFFChunk.write("IPRD", encoder.encode(metadata.album), true));
    if (metadata.genre) infoChunks.push(RIFFChunk.write("IGNR", encoder.encode(metadata.genre), true));
    if (metadata.title) infoChunks.push(RIFFChunk.write("INAM", encoder.encode(metadata.title), true));
    infoChunk = RIFFChunk.writeParts("INFO", infoChunks, true);
  }
  let cueChunk = new IndexedByteArray(0);
  const cueOn = loop?.end !== void 0 && loop?.start !== void 0;
  if (cueOn) {
    const loopStartSamples = Math.floor(loop.start * sampleRate);
    const loopEndSamples = Math.floor(loop.end * sampleRate);
    const cueStart = new IndexedByteArray(24);
    writeLittleEndianIndexed(cueStart, 0, 4);
    writeLittleEndianIndexed(cueStart, 0, 4);
    writeBinaryStringIndexed(cueStart, "data");
    writeLittleEndianIndexed(cueStart, 0, 4);
    writeLittleEndianIndexed(cueStart, 0, 4);
    writeLittleEndianIndexed(cueStart, loopStartSamples, 4);
    const cueEnd = new IndexedByteArray(24);
    writeLittleEndianIndexed(cueEnd, 1, 4);
    writeLittleEndianIndexed(cueEnd, 0, 4);
    writeBinaryStringIndexed(cueEnd, "data");
    writeLittleEndianIndexed(cueEnd, 0, 4);
    writeLittleEndianIndexed(cueEnd, 0, 4);
    writeLittleEndianIndexed(cueEnd, loopEndSamples, 4);
    cueChunk = RIFFChunk.writeParts("cue ", [
      new IndexedByteArray([
        2,
        0,
        0,
        0
      ]),
      cueStart,
      cueEnd
    ]);
  }
  const headerSize = 44;
  const dataSize = length * numChannels * bytesPerSample;
  const fileSize = headerSize + dataSize + infoChunk.length + cueChunk.length - 8;
  const header = new Uint8Array(headerSize);
  header.set([
    82,
    73,
    70,
    70
  ], 0);
  header.set(new Uint8Array([
    fileSize & 255,
    fileSize >> 8 & 255,
    fileSize >> 16 & 255,
    fileSize >> 24 & 255
  ]), 4);
  header.set([
    87,
    65,
    86,
    69
  ], 8);
  header.set([
    102,
    109,
    116,
    32
  ], 12);
  header.set([
    16,
    0,
    0,
    0
  ], 16);
  header.set([1, 0], 20);
  header.set([numChannels & 255, numChannels >> 8], 22);
  header.set(new Uint8Array([
    sampleRate & 255,
    sampleRate >> 8 & 255,
    sampleRate >> 16 & 255,
    sampleRate >> 24 & 255
  ]), 24);
  const byteRate = sampleRate * numChannels * bytesPerSample;
  header.set(new Uint8Array([
    byteRate & 255,
    byteRate >> 8 & 255,
    byteRate >> 16 & 255,
    byteRate >> 24 & 255
  ]), 28);
  header.set([numChannels * bytesPerSample, 0], 32);
  header.set([16, 0], 34);
  header.set([
    100,
    97,
    116,
    97
  ], 36);
  header.set(new Uint8Array([
    dataSize & 255,
    dataSize >> 8 & 255,
    dataSize >> 16 & 255,
    dataSize >> 24 & 255
  ]), 40);
  const wavData = new Uint8Array(fileSize + 8);
  let offset = headerSize;
  wavData.set(header, 0);
  let multiplier = 32767;
  if (fullOptions.normalizeAudio) {
    const numSamples = audioData[0].length;
    let maxAbsValue = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      const data = audioData[ch];
      for (let i = 0; i < numSamples; i++) {
        const sample = Math.abs(data[i]);
        if (sample > maxAbsValue) maxAbsValue = sample;
      }
    }
    multiplier = maxAbsValue > 0 ? 32767 / maxAbsValue : 1;
  }
  for (let i = 0; i < length; i++) for (const d of audioData) {
    const sample = Math.min(32767, Math.max(-32768, d[i] * multiplier));
    wavData[offset++] = sample & 255;
    wavData[offset++] = sample >> 8 & 255;
  }
  if (infoOn) {
    wavData.set(infoChunk, offset);
    offset += infoChunk.length;
  }
  if (cueOn) wavData.set(cueChunk, offset);
  return wavData.buffer;
}
var SpessaLog = class SpessaLog2 {
  /**
  * The most verbose log level, prints out a lot of small details.
  */
  static infoEnabled = false;
  /**
  * The default log level, prints out warnings for unexpected and erroneous behavior.
  */
  static warnEnabled = true;
  /**
  * If grouping of the log messages is allowed. Recommended for the `info` verbosity level.
  */
  static groupEnabled = false;
  /**
  * Enables or disables logging.
  * @param enableInfo enables info.
  * @param enableWarn enables warning.
  * @param enableGroup enables groups.
  */
  static setLogLevel(enableInfo, enableWarn, enableGroup) {
    this.infoEnabled = enableInfo;
    this.warnEnabled = enableWarn;
    this.groupEnabled = enableGroup;
  }
  static info(...message) {
    if (this.infoEnabled) console.info(...message);
  }
  static warn(...message) {
    if (this.warnEnabled) console.warn(...message);
  }
  static group(...message) {
    if (this.groupEnabled) console.group(...message);
  }
  static groupCollapsed(...message) {
    if (this.groupEnabled) console.groupCollapsed(...message);
  }
  static groupEnd() {
    if (this.groupEnabled) console.groupEnd();
  }
  /**
  * @internal
  */
  static unsupported(what, syx, reason = "") {
    if (this.infoEnabled) this.info(`%cUnsupported %c${what}%c message: %c${arrayToHexString(syx)}%c. ${reason}`, ConsoleColors.warn, ConsoleColors.recognized, ConsoleColors.warn, ConsoleColors.unrecognized, ConsoleColors.warn);
  }
  /**
  * @internal
  */
  static gmInfo(what, value, unit = "") {
    if (this.infoEnabled) this.coolInfo(`General MIDI ${what}`, value, unit);
  }
  /**
  * @internal
  */
  static gmFail(what, syx) {
    if (this.infoEnabled) this.unsupported(`General MIDI ${what}`, syx);
  }
  /**
  * @internal
  */
  static gsInfo(what, value, unit = "") {
    if (this.infoEnabled) this.coolInfo(`Roland GS ${what}`, value, unit);
  }
  /**
  * @internal
  */
  static gsFail(what, syx, reason = "") {
    if (this.infoEnabled) this.unsupported(`Roland GS ${what}`, syx, reason);
  }
  /**
  * @internal
  */
  static xgInfo(what, value, unit = "") {
    if (this.infoEnabled) this.coolInfo(`Yamaha XG ${what}`, value, unit);
  }
  /**
  * @internal
  */
  static xgFail(what, syx, reason = "") {
    if (this.infoEnabled) this.unsupported(`Yamaha XG ${what}`, syx, reason);
  }
  /**
  * @internal
  */
  static coolInfo(what, value, unit = "") {
    if (!this.infoEnabled) return;
    if (unit) SpessaLog2.info(`%c${what}%c is now set to %c${value}%c ${unit}.`, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.value, ConsoleColors.info);
    else SpessaLog2.info(`%c${what}%c is now set to %c${value}%c.`, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.value, ConsoleColors.info);
  }
};
var SpessaSynthCoreUtils = {
  ConsoleColors,
  readBigEndian,
  readLittleEndian,
  readLittleEndianIndexed,
  readBinaryString,
  readBinaryStringIndexed,
  readVariableLengthQuantity,
  inflateSync: inf
};
var MIDIMessageTypes = {
  noteOff: 128,
  noteOn: 144,
  polyPressure: 160,
  controllerChange: 176,
  programChange: 192,
  channelPressure: 208,
  pitchWheel: 224,
  systemExclusive: 240,
  timecode: 241,
  songPosition: 242,
  songSelect: 243,
  tuneRequest: 246,
  clock: 248,
  start: 250,
  continue: 251,
  stop: 252,
  activeSensing: 254,
  reset: 255,
  sequenceNumber: 0,
  text: 1,
  copyright: 2,
  trackName: 3,
  instrumentName: 4,
  lyric: 5,
  marker: 6,
  cuePoint: 7,
  programName: 8,
  midiChannelPrefix: 32,
  midiPort: 33,
  endOfTrack: 47,
  setTempo: 81,
  smpteOffset: 84,
  timeSignature: 88,
  keySignature: 89,
  sequenceSpecific: 127
};
var MIDIControllers = {
  bankSelect: 0,
  modulationWheel: 1,
  breathController: 2,
  undefinedCC3: 3,
  footController: 4,
  portamentoTime: 5,
  dataEntryMSB: 6,
  mainVolume: 7,
  balance: 8,
  undefinedCC9: 9,
  pan: 10,
  expression: 11,
  effectControl1: 12,
  effectControl2: 13,
  undefinedCC14: 14,
  undefinedCC15: 15,
  generalPurposeController1: 16,
  generalPurposeController2: 17,
  generalPurposeController3: 18,
  generalPurposeController4: 19,
  undefinedCC20: 20,
  undefinedCC21: 21,
  undefinedCC22: 22,
  undefinedCC23: 23,
  undefinedCC24: 24,
  undefinedCC25: 25,
  undefinedCC26: 26,
  undefinedCC27: 27,
  undefinedCC28: 28,
  undefinedCC29: 29,
  undefinedCC30: 30,
  undefinedCC31: 31,
  bankSelectLSB: 32,
  modulationWheelLSB: 33,
  breathControllerLSB: 34,
  undefinedCC3LSB: 35,
  footControllerLSB: 36,
  portamentoTimeLSB: 37,
  dataEntryLSB: 38,
  mainVolumeLSB: 39,
  balanceLSB: 40,
  undefinedCC9LSB: 41,
  panLSB: 42,
  expressionLSB: 43,
  effectControl1LSB: 44,
  effectControl2LSB: 45,
  undefinedCC14LSB: 46,
  undefinedCC15LSB: 47,
  undefinedCC16LSB: 48,
  undefinedCC17LSB: 49,
  undefinedCC18LSB: 50,
  undefinedCC19LSB: 51,
  undefinedCC20LSB: 52,
  undefinedCC21LSB: 53,
  undefinedCC22LSB: 54,
  undefinedCC23LSB: 55,
  undefinedCC24LSB: 56,
  undefinedCC25LSB: 57,
  undefinedCC26LSB: 58,
  undefinedCC27LSB: 59,
  undefinedCC28LSB: 60,
  undefinedCC29LSB: 61,
  undefinedCC30LSB: 62,
  undefinedCC31LSB: 63,
  sustainPedal: 64,
  portamentoOnOff: 65,
  sostenutoPedal: 66,
  softPedal: 67,
  legatoFootswitch: 68,
  hold2Pedal: 69,
  soundVariation: 70,
  filterResonance: 71,
  releaseTime: 72,
  attackTime: 73,
  brightness: 74,
  decayTime: 75,
  vibratoRate: 76,
  vibratoDepth: 77,
  vibratoDelay: 78,
  soundController10: 79,
  generalPurposeController5: 80,
  generalPurposeController6: 81,
  generalPurposeController7: 82,
  generalPurposeController8: 83,
  portamentoControl: 84,
  undefinedCC85: 85,
  undefinedCC86: 86,
  undefinedCC87: 87,
  undefinedCC88: 88,
  undefinedCC89: 89,
  undefinedCC90: 90,
  reverbDepth: 91,
  tremoloDepth: 92,
  chorusDepth: 93,
  variationDepth: 94,
  phaserDepth: 95,
  dataIncrement: 96,
  dataDecrement: 97,
  nonRegisteredParameterLSB: 98,
  nonRegisteredParameterMSB: 99,
  registeredParameterLSB: 100,
  registeredParameterMSB: 101,
  undefinedCC102LSB: 102,
  undefinedCC103LSB: 103,
  undefinedCC104LSB: 104,
  undefinedCC105LSB: 105,
  undefinedCC106LSB: 106,
  undefinedCC107LSB: 107,
  undefinedCC108LSB: 108,
  undefinedCC109LSB: 109,
  undefinedCC110LSB: 110,
  undefinedCC111LSB: 111,
  undefinedCC112LSB: 112,
  undefinedCC113LSB: 113,
  undefinedCC114LSB: 114,
  undefinedCC115LSB: 115,
  undefinedCC116LSB: 116,
  undefinedCC117LSB: 117,
  undefinedCC118LSB: 118,
  undefinedCC119LSB: 119,
  allSoundOff: 120,
  resetAllControllers: 121,
  localControlOnOff: 122,
  allNotesOff: 123,
  omniModeOff: 124,
  omniModeOn: 125,
  monoModeOn: 126,
  polyModeOn: 127
};
var RegisteredParameterTypes = {
  pitchWheelRange: 0,
  fineTuning: 1,
  coarseTuning: 2,
  modulationDepth: 5,
  resetParameters: 16383
};
var NonRegisteredMSB = {
  partParameter: 1,
  drumPitch: 24,
  drumPitchFine: 25,
  drumLevel: 26,
  drumPan: 28,
  drumReverb: 29,
  drumChorus: 30,
  drumDelay: 31,
  awe32: 127,
  SF2: 120
};
var NonRegisteredLSB = {
  vibratoRate: 8,
  vibratoDepth: 9,
  vibratoDelay: 10,
  tvfCutoffFrequency: 32,
  tvfResonance: 33,
  envelopeAttackTime: 99,
  envelopeDecayTime: 100,
  envelopeReleaseTime: 102
};
var MIDIMessage = class MIDIMessage2 {
  /**
  * Absolute number of MIDI ticks from the start of the track.
  */
  ticks;
  /**
  * The MIDI message status byte. Note that for meta events, it is the second byte. (not 0xFF).
  */
  statusByte;
  /**
  * Message's binary data.
  */
  data;
  /**
  * Creates a new MIDI message.
  * @param ticks time of this message in absolute MIDI ticks.
  * @param byte the message status byte.
  * @param data the message's binary data.
  */
  constructor(ticks, byte, data) {
    this.ticks = ticks;
    this.statusByte = byte;
    this.data = data;
  }
  /**
  * Returns a new MIDI Pitch Wheel message.
  * @param ticks time of this message in absolute MIDI ticks.
  * @param channel the channel number of this message.
  * @param value the new value, between 0 and 16383, where 8192 is the center (no pitch change).
  */
  static pitchWheel(ticks, channel, value) {
    return new MIDIMessage2(ticks, MIDIMessageTypes.pitchWheel | channel % 16, new Uint8Array([value & 127, value >> 7 & 127]));
  }
  /**
  * Returns a new MIDI Channel Pressure message.
  * @param ticks time of this message in absolute MIDI ticks.
  * @param channel the channel number of this message.
  * @param value the new value, between 0 and 127.
  */
  static channelPressure(ticks, channel, value) {
    return new MIDIMessage2(ticks, MIDIMessageTypes.channelPressure | channel % 16, new Uint8Array([value]));
  }
  /**
  * Returns a new MIDI Program Change message.
  * @param ticks time of this message in absolute MIDI ticks.
  * @param channel the channel number of this message.
  * @param program the new MIDI program number, between 0 and 127.
  */
  static programChange(ticks, channel, program) {
    return new MIDIMessage2(ticks, MIDIMessageTypes.programChange | channel % 16, new Uint8Array([program]));
  }
  /**
  * Returns a new MIDI Controller Change message.
  * @param ticks time of this message in absolute MIDI ticks.
  * @param channel the channel number of this message.
  * @param controller the MIDI controller.
  * @param value the new value.
  */
  static controllerChange(ticks, channel, controller, value) {
    return new MIDIMessage2(ticks, MIDIMessageTypes.controllerChange | channel % 16, new Uint8Array([controller, value]));
  }
  /**
  * Returns a new MIDI System Exclusive message.
  * @param ticks time of this message in absolute MIDI ticks.
  * @param data the data of the system exclusive message,
  * excluding the starting 0xF0 byte.
  */
  static systemExclusive(ticks, data) {
    return new MIDIMessage2(ticks, MIDIMessageTypes.systemExclusive, new Uint8Array(data));
  }
  /**
  * Returns a new MIDI Registered Parameter message. Sends both data MSB and LSB.
  * @param ticks time of this message in absolute MIDI ticks.
  * @param channel the channel number of this message.
  * @param parameter the 14-bit MIDI registered parameter number.
  * @param value the 14-bit new value.
  */
  static registeredParameter(ticks, channel, parameter, value) {
    if (parameter > 16383 || parameter < 0 || value > 16383 || value < 0) throw new Error("Parameter and value must be between 0 and 16383.");
    return [
      MIDIMessage2.controllerChange(ticks, channel, MIDIControllers.registeredParameterMSB, parameter >> 7),
      MIDIMessage2.controllerChange(ticks, channel, MIDIControllers.registeredParameterLSB, parameter & 127),
      MIDIMessage2.controllerChange(ticks, channel, MIDIControllers.dataEntryMSB, value >> 7),
      MIDIMessage2.controllerChange(ticks, channel, MIDIControllers.dataEntryLSB, value & 127)
    ];
  }
};
var writeText = (text, arr) => {
  for (let i = 0; i < text.length; i++) arr.push(text.charCodeAt(i));
};
function writeMIDIInternal(midi) {
  if (!midi.tracks) throw new Error("MIDI has no tracks!");
  const binaryTrackData = [];
  for (const track of midi.tracks) {
    const binaryTrack = [];
    let currentTick = 0;
    let runningByte = void 0;
    for (const event of track.events) {
      const deltaTicks = Math.max(0, event.ticks - currentTick);
      if (event.statusByte === MIDIMessageTypes.endOfTrack) {
        currentTick += deltaTicks;
        continue;
      }
      let messageData;
      if (event.statusByte <= MIDIMessageTypes.sequenceSpecific) {
        messageData = [
          255,
          event.statusByte,
          ...writeVariableLengthQuantity(event.data.length),
          ...event.data
        ];
        runningByte = void 0;
      } else if (event.statusByte === MIDIMessageTypes.systemExclusive) {
        messageData = [
          240,
          ...writeVariableLengthQuantity(event.data.length),
          ...event.data
        ];
        runningByte = void 0;
      } else {
        messageData = [];
        if (runningByte !== event.statusByte) {
          runningByte = event.statusByte;
          messageData.push(event.statusByte);
        }
        messageData.push(...event.data);
      }
      binaryTrack.push(...writeVariableLengthQuantity(deltaTicks), ...messageData);
      currentTick += deltaTicks;
    }
    binaryTrack.push(0, 255, MIDIMessageTypes.endOfTrack, 0);
    binaryTrackData.push(binaryTrack);
  }
  let binaryData = [];
  writeText("MThd", binaryData);
  binaryData.push(...writeBigEndian(6, 4), 0, midi.format, ...writeBigEndian(midi.tracks.length, 2), ...writeBigEndian(midi.timeDivision, 2));
  for (const track of binaryTrackData) {
    writeText("MTrk", binaryData);
    binaryData = binaryData.concat(writeBigEndian(track.length, 4), track);
  }
  return new Uint8Array(binaryData).buffer;
}
var EMBEDDED_SOUND_BANK_ID = `SPESSASYNTH_EMBEDDED_BANK_${Math.random()}_DO_NOT_DELETE`;
var GENERATOR_OVERRIDE_NO_CHANGE_VALUE = 32767;
var DEFAULT_SYNTH_METHOD_OPTIONS = { time: 0 };
var MIN_NOTE_LENGTH = 0.03;
var MIN_EXCLUSIVE_LENGTH = 0.07;
var SPESSASYNTH_GAIN_FACTOR = 0.6;
var EFX_SENDS_GAIN_CORRECTION = 1 / Math.cos(Math.PI / 4) ** 2;
var GM2_DEFAULT_BANK = 121;
var BankSelectHacks = class {
  /**
  * GM2 has a different default bank number
  */
  static getDefaultBank(sys) {
    return sys === "gm2" ? GM2_DEFAULT_BANK : 0;
  }
  static getDrumBank(sys) {
    switch (sys) {
      default:
        throw new Error(`${sys} doesn't have a bank MSB for drums.`);
      case "gm2":
        return 120;
      case "xg":
        return 127;
    }
  }
  /**
  * Checks if this bank number is XG drums.
  */
  static isXGDrum(bankMSB) {
    return bankMSB === 120 || bankMSB === 127;
  }
  /**
  * Checks if this MSB is a valid XG MSB
  */
  static isValidXGMSB(bankMSB) {
    return this.isXGDrum(bankMSB) || bankMSB === 64 || bankMSB === GM2_DEFAULT_BANK;
  }
  static isSystemXG(system) {
    return system === "gm2" || system === "xg";
  }
  static addBankOffset(bankMSB, bankOffset, isXG) {
    if (this.isXGDrum(bankMSB) && isXG) return bankMSB;
    return Math.min(bankMSB + bankOffset, 127);
  }
  static subtractBankOffset(bankMSB, bankOffset, isXG) {
    if (this.isXGDrum(bankMSB) && isXG) return bankMSB;
    return Math.max(0, bankMSB - bankOffset);
  }
};
var MIDIPatchTools = class MIDIPatchTools2 {
  /**
  * Converts a given `MIDIPatch` to a string.
  * The format is:
  * - `DRUM:program` for `GMGSDrum` set to `true`.
  * - `bankLSB:bankMSB:program` for `GMGSDrum` set to `false`.
  */
  static toMIDIString(patch) {
    if (patch.isGMGSDrum) return `DRUM:${patch.program}`;
    return `${patch.bankLSB}:${patch.bankMSB}:${patch.program}`;
  }
  /**
  * Gets `MIDIPatch` from a given string.
  */
  static fromMIDIString(string) {
    const parts = string.split(":");
    if (parts.length > 3 || parts.length < 2) throw new Error(`Invalid MIDI string: ${string}`);
    return string.startsWith("DRUM") ? {
      bankMSB: 0,
      bankLSB: 0,
      program: Number.parseInt(parts[1]),
      isGMGSDrum: true
    } : {
      bankLSB: Number.parseInt(parts[0]),
      bankMSB: Number.parseInt(parts[1]),
      program: Number.parseInt(parts[2]),
      isGMGSDrum: false
    };
  }
  /**
  * Converts a given `MIDIPatchFull`to string.
  * The format is:
  * - `<MIDIPatch string> D <name>` for `isDrum` set to `true`.
  * - `<MIDIPatch string> M <name>` for `isDrum` set to `true`.
  */
  static toFullMIDIString(patch) {
    return `${this.toMIDIString(patch)} ${patch.isDrum ? "D" : "M"} ${patch.name}`;
  }
  /**
  * Gets `MIDIPatchFull` from a given string.
  */
  static fromFullMIDIString(string) {
    const firstSpace = string.indexOf(" ");
    const secondSpace = string.indexOf(" ", firstSpace + 1);
    if (firstSpace === -1 || secondSpace === -1) throw new Error(`Invalid named MIDI string: ${string}`);
    const midiPart = string.slice(0, Math.max(0, firstSpace));
    const drumMode = string.slice(firstSpace + 1, secondSpace);
    const name = string.slice(Math.max(0, secondSpace + 1));
    return {
      ...MIDIPatchTools2.fromMIDIString(midiPart),
      isDrum: drumMode === "D",
      name
    };
  }
  /**
  * Checks if two MIDI patches represent the same one.
  */
  static matches(patch1, patch2) {
    if (patch1.isGMGSDrum || patch2.isGMGSDrum) return patch1.isGMGSDrum === patch2.isGMGSDrum && patch1.program === patch2.program;
    return patch1.program === patch2.program && patch1.bankLSB === patch2.bankLSB && patch1.bankMSB === patch2.bankMSB;
  }
  /**
  * A comparison function for `.sort()` or `.toSorted()`,
  * ordering the patches in ascending order.
  */
  static compare(a, b) {
    if (a.isGMGSDrum && !b.isGMGSDrum) return 1;
    if (!a.isGMGSDrum && b.isGMGSDrum) return -1;
    if (a.program !== b.program) return a.program - b.program;
    if (a.bankMSB !== b.bankMSB) return a.bankMSB - b.bankMSB;
    return a.bankLSB - b.bankLSB;
  }
  /**
  * Checks if the given `MIDIPatchFull` is an XG/GM2 drum patch.
  */
  static isXGDrum(p) {
    return p.isDrum && !p.isGMGSDrum;
  }
  /**
  * A sophisticated patch selection system based on the MIDI Patch system.
  * This is the algorithm that the synthesizer uses for selecting presets.
  * @param patches The `MIDIPatchFull` array to select from.
  * @param patch The `MIDIPatch` to select.
  * @param system The MIDI system to select for.
  * @returns The selected patch.
  */
  static selectPatch(patches, patch, system) {
    if (patches.length === 0) throw new Error("No presets!");
    if (patch.isGMGSDrum && BankSelectHacks.isSystemXG(system)) patch = {
      ...patch,
      isGMGSDrum: false,
      bankLSB: 0,
      bankMSB: BankSelectHacks.getDrumBank(system)
    };
    const { isGMGSDrum, bankLSB, bankMSB, program } = patch;
    const isXG = BankSelectHacks.isSystemXG(system);
    const xgDrums = BankSelectHacks.isXGDrum(bankMSB) && isXG;
    let p = patches.find((p2) => this.matches(p2, patch));
    if (p && (!xgDrums || xgDrums && this.isXGDrum(p))) return p;
    const returnReplacement = (pres) => {
      SpessaLog.info(`%cPreset %c${MIDIPatchTools2.toMIDIString(patch)}%c not found. (${system}) Replaced with %c${this.toFullMIDIString(pres)}`, ConsoleColors.warn, ConsoleColors.unrecognized, ConsoleColors.warn, ConsoleColors.value);
    };
    if (isGMGSDrum) {
      let p2 = patches.find((p3) => p3.isGMGSDrum && p3.program === program);
      if (p2) {
        returnReplacement(p2);
        return p2;
      }
      p2 = patches.find((p3) => p3.isDrum && p3.program === program);
      if (p2) {
        returnReplacement(p2);
        return p2;
      }
      p2 = this.getAnyDrums(patches, false);
      returnReplacement(p2);
      return p2;
    }
    if (xgDrums) {
      let p2 = patches.find((p3) => p3.program === program && p3.isDrum && !p3.isGMGSDrum);
      if (p2) {
        returnReplacement(p2);
        return p2;
      }
      p2 = patches.find((p3) => p3.isDrum && p3.program === program);
      if (p2 && p2.program < 49) {
        returnReplacement(p2);
        return p2;
      }
      p2 = this.getAnyDrums(patches, true);
      returnReplacement(p2);
      return p2;
    }
    const matchingPrograms = patches.filter((p2) => p2.program === program && !p2.isDrum);
    if (matchingPrograms.length === 0) {
      returnReplacement(patches[0]);
      return patches[0];
    }
    p = isXG ? matchingPrograms.find((p2) => p2.bankLSB === bankLSB) : matchingPrograms.find((p2) => p2.bankMSB === bankMSB);
    if (p) {
      returnReplacement(p);
      return p;
    }
    if (bankLSB !== 64 || !isXG) {
      const bank = Math.max(bankMSB, bankLSB);
      p = matchingPrograms.find((p2) => p2.bankLSB === bank || p2.bankMSB === bank);
      if (p) {
        returnReplacement(p);
        return p;
      }
    }
    returnReplacement(matchingPrograms[0]);
    return matchingPrograms[0];
  }
  static getAnyDrums(presets, preferXG) {
    const p = preferXG ? presets.find((p2) => this.isXGDrum(p2)) : presets.find((p2) => p2.isGMGSDrum);
    if (p) return p;
    return presets.find((p2) => p2.isDrum) ?? presets[0];
  }
};
var OTHER = Object.freeze({ type: "Other" });
var MIDIUtils = class MIDIUtils2 {
  /**
  * Analyzes a MIDI System Exclusive message
  * and returns an identification and data for it.
  * @param syx the System Exclusive message, WITHOUT the first 0xF0 System Exclusive byte!
  */
  static analyzeSysEx(syx) {
    if (syx.length < 3) return OTHER;
    switch (syx[0]) {
      default:
        return OTHER;
      case 126:
      case 127:
        return this.analyzeGM(syx);
      case 65:
        return this.analyzeGS(syx);
      case 67:
        return this.analyzeXG(syx);
    }
  }
  /**
  * Analyzes a MIDI Registered Parameter Number
  * and returns an identification and data for it.
  * @param channel The MIDI channel number.
  * @param rpn The 14-bit RPN number.
  * @param value The 14-bit value for that number.
  */
  static analyzeRPN(channel, rpn, value) {
    switch (rpn) {
      default:
        return OTHER;
      case RegisteredParameterTypes.pitchWheelRange:
        return {
          type: "Channel MIDI Param",
          channel,
          parameter: "pitchWheelRange",
          value: value / 128
        };
      case RegisteredParameterTypes.fineTuning:
        return {
          type: "Channel MIDI Param",
          channel,
          parameter: "fineTune",
          value: (value - 8192) / 81.92
        };
      case RegisteredParameterTypes.coarseTuning:
        return {
          type: "Channel MIDI Param",
          channel,
          parameter: "keyShift",
          value: (value >> 7) - 64
        };
      case RegisteredParameterTypes.modulationDepth:
        return {
          type: "Channel MIDI Param",
          channel,
          parameter: "modulationDepth",
          value: value / 1.28
        };
    }
  }
  /**
  * Analyzes a MIDI Non-Registered Parameter Number
  * and returns an identification and data for it.
  * @param channel The MIDI channel number.
  * @param nrpn The 14-bit NRPN number.
  * @param value The 14-bit value for that number.
  */
  static analyzeNRPN(channel, nrpn, value) {
    const msb = nrpn >> 7;
    const lsb = nrpn & 127;
    switch (msb) {
      default:
        return OTHER;
      case NonRegisteredMSB.partParameter:
        switch (lsb) {
          default:
            return OTHER;
          case NonRegisteredLSB.vibratoRate:
            return {
              type: "Controller Change",
              channel,
              controller: MIDIControllers.vibratoRate,
              value: value >> 7
            };
          case NonRegisteredLSB.vibratoDepth:
            return {
              type: "Controller Change",
              channel,
              controller: MIDIControllers.vibratoDepth,
              value: value >> 7
            };
          case NonRegisteredLSB.vibratoDelay:
            return {
              type: "Controller Change",
              channel,
              controller: MIDIControllers.vibratoDelay,
              value: value >> 7
            };
          case NonRegisteredLSB.tvfCutoffFrequency:
            return {
              type: "Controller Change",
              channel,
              controller: MIDIControllers.brightness,
              value: value >> 7
            };
          case NonRegisteredLSB.tvfResonance:
            return {
              type: "Controller Change",
              channel,
              controller: MIDIControllers.filterResonance,
              value: value >> 7
            };
          case NonRegisteredLSB.envelopeAttackTime:
            return {
              type: "Controller Change",
              channel,
              controller: MIDIControllers.attackTime,
              value: value >> 7
            };
          case NonRegisteredLSB.envelopeDecayTime:
            return {
              type: "Controller Change",
              channel,
              controller: MIDIControllers.decayTime,
              value: value >> 7
            };
          case NonRegisteredLSB.envelopeReleaseTime:
            return {
              type: "Controller Change",
              channel,
              controller: MIDIControllers.releaseTime,
              value: value >> 7
            };
        }
      case NonRegisteredMSB.drumPitch:
      case NonRegisteredMSB.drumPitchFine:
      case NonRegisteredMSB.drumLevel:
      case NonRegisteredMSB.drumPan:
      case NonRegisteredMSB.drumReverb:
      case NonRegisteredMSB.drumChorus:
      case NonRegisteredMSB.drumDelay:
        return { type: "Drum Setup" };
    }
  }
  /**
  * Returns a list of MIDI events needed to set the given parameter.
  * @param ticks The ticks for all events.
  * @param system If the message has multiple ways of setting it,
  * this selects the preferred way. Otherwise, it prefers Universal (GM).
  * @param parameter The parameter to set.
  * @param value The value to set it to.
  */
  static setGlobalMIDIParameter(ticks, system, parameter, value) {
    switch (parameter) {
      case "system":
        return [MIDIUtils2.reset(ticks, value)];
      case "keyShift":
        switch (system) {
          default:
            return [MIDIUtils2.deviceControlMessage(ticks, 4, [0, value + 64])];
          case "xg":
            return [MIDIUtils2.xgMessage(ticks, 0, 0, 6, [value + 64])];
          case "gs":
            return [MIDIUtils2.gsMessage(ticks, 64, 0, 5, [value + 64])];
        }
      case "fineTune":
        switch (system) {
          default: {
            const tuneValue = Math.floor(value * 81.92 + 8192);
            return [MIDIUtils2.deviceControlMessage(ticks, 3, [tuneValue & 127, tuneValue >> 7 & 127])];
          }
          case "xg": {
            const tuneValue = Math.floor(value * 10 + 1024);
            return [MIDIUtils2.xgMessage(ticks, 0, 0, 0, [
              tuneValue >> 12 & 15,
              tuneValue >> 8 & 15,
              tuneValue >> 4 & 15,
              tuneValue & 15
            ])];
          }
          case "gs": {
            const tuneValue = Math.floor(value * 10 + 1024);
            return [MIDIUtils2.gsMessage(ticks, 64, 0, 0, [
              tuneValue >> 12 & 15,
              tuneValue >> 8 & 15,
              tuneValue >> 4 & 15,
              tuneValue & 15
            ])];
          }
        }
      case "volume":
        switch (system) {
          default: {
            const gainValue = Math.floor(value * 16383);
            return [MIDIUtils2.deviceControlMessage(ticks, 1, [gainValue & 127, gainValue >> 7 & 127])];
          }
          case "xg": {
            const gainValue = Math.floor(value * 127);
            return [MIDIUtils2.xgMessage(ticks, 0, 0, 4, [gainValue])];
          }
          case "gs": {
            const gainValue = Math.floor(value * 127);
            return [MIDIUtils2.gsMessage(ticks, 64, 0, 4, [gainValue])];
          }
        }
      case "pan":
        switch (system) {
          default: {
            const balance = Math.floor(value * 8192) + 8192;
            return [MIDIUtils2.deviceControlMessage(ticks, 2, [balance & 127, balance >> 7 & 127])];
          }
          case "gs": {
            const balance = Math.floor(value * 63) + 64;
            return [MIDIUtils2.gsMessage(ticks, 64, 0, 6, [balance])];
          }
        }
    }
  }
  /**
  * Returns a list of MIDI events needed to set the given parameter.
  * @param ticks The ticks for all events.
  * @param channel The channel number.
  * @param system If the message has multiple ways of setting it,
  * this selects the preferred way. Otherwise, it prefers Universal (GM).
  * @param parameter The parameter to set.
  * @param value The value to set it to.
  * @returns The list of `MIDIMessage`s that set the parameter.
  */
  static setChannelMIDIParameter(ticks, channel, system, parameter, value) {
    channel %= 16;
    const gsChannel = MIDIUtils2.channelToSyx(channel);
    switch (parameter) {
      case "pressure":
        return [MIDIMessage.channelPressure(ticks, channel, value)];
      case "pitchWheel":
        return [MIDIMessage.pitchWheel(ticks, channel, value)];
      case "pitchWheelRange":
        return MIDIMessage.registeredParameter(ticks, channel, RegisteredParameterTypes.pitchWheelRange, Math.floor(value * 128));
      case "modulationDepth":
        return MIDIMessage.registeredParameter(ticks, channel, RegisteredParameterTypes.modulationDepth, Math.floor(value * 1.28));
      case "rxChannel":
        return system === "xg" ? [MIDIUtils2.xgMessage(ticks, 8, channel, 4, [value])] : [MIDIUtils2.gsMessage(ticks, 64, 16 | gsChannel, 2, [value])];
      case "polyMode":
        return value ? [MIDIMessage.controllerChange(ticks, channel, MIDIControllers.polyModeOn, 0)] : [MIDIMessage.controllerChange(ticks, channel, MIDIControllers.monoModeOn, 0)];
      case "keyShift":
        return MIDIMessage.registeredParameter(ticks, channel, RegisteredParameterTypes.coarseTuning, value + 64 << 7);
      case "fineTune":
        return MIDIMessage.registeredParameter(ticks, channel, RegisteredParameterTypes.fineTuning, Math.floor(value * 81.92 + 8192));
      case "randomPan":
        return system === "xg" ? [MIDIUtils2.xgMessage(ticks, 8, channel, 14, [0])] : [MIDIUtils2.gsMessage(ticks, 64, 16 | gsChannel, 28, [0])];
      case "assignMode":
        switch (system) {
          default:
          case "gs":
            return [MIDIUtils2.gsMessage(ticks, 64, 16 | gsChannel, 20, [value])];
          case "xg":
            return [MIDIUtils2.xgMessage(ticks, 8, channel, 6, [value])];
        }
      case "efxAssign":
        return [MIDIUtils2.gsMessage(ticks, 64, 16 | gsChannel, 34, [value])];
      case "cc1":
        return [MIDIUtils2.gsMessage(ticks, 64, 16 | gsChannel, 31, [value])];
      case "cc2":
        return [MIDIUtils2.gsMessage(ticks, 64, 16 | gsChannel, 32, [value])];
      case "drumMap":
        return [MIDIUtils2.gsMessage(ticks, 64, 16 | gsChannel, 21, [value])];
      case "velocitySenseDepth":
        return system === "xg" ? [MIDIUtils2.xgMessage(ticks, 8, channel, 12, [value])] : [MIDIUtils2.gsMessage(ticks, 64, 16 | gsChannel, 26, [value])];
      case "velocitySenseOffset":
        return system === "xg" ? [MIDIUtils2.xgMessage(ticks, 8, channel, 13, [value])] : [MIDIUtils2.gsMessage(ticks, 64, 16 | gsChannel, 27, [value])];
    }
  }
  /**
  * Converts GS/XG "part number" to MIDI channel number.
  * @param part The part number.
  */
  static syxToChannel(part) {
    return [
      9,
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      10,
      11,
      12,
      13,
      14,
      15
    ][part % 16];
  }
  /**
  * Converts MIDI channel number to GS/XG "part number".
  * @param channel The MIDI channel number.
  */
  static channelToSyx(channel) {
    return [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      0,
      10,
      11,
      12,
      13,
      14,
      15
    ][channel % 16];
  }
  /**
  * Gets raw GS System Exclusive message bytes, without the 0xF0 status byte.
  * @param a1 Address 1
  * @param a2 Address 2
  * @param a3 Address 3
  * @param data Data, can be multiple bytes.
  */
  static gs(a1, a2, a3, data) {
    const checksum = 128 - (a1 + a2 + a3 + data.reduce((sum, cur) => sum + cur, 0)) % 128 & 127;
    return [
      65,
      16,
      66,
      18,
      a1,
      a2,
      a3,
      ...data,
      checksum,
      247
    ];
  }
  /**
  * Gets a GS System Exclusive MIDI message.
  * @param ticks The tick time of the message.
  * @param a1 Address 1
  * @param a2 Address 2
  * @param a3 Address 3
  * @param data Data, can be multiple bytes.
  */
  static gsMessage(ticks, a1, a2, a3, data) {
    return MIDIMessage.systemExclusive(ticks, this.gs(a1, a2, a3, data));
  }
  /**
  * Gets raw XG System Exclusive message bytes, without the 0xF0 status byte.
  * @param a1 Address 1
  * @param a2 Address 2
  * @param a3 Address 3
  * @param data Data, can be multiple bytes.
  */
  static xg(a1, a2, a3, data) {
    return [
      67,
      16,
      76,
      a1,
      a2,
      a3,
      ...data,
      247
    ];
  }
  /**
  * Gets a XG System Exclusive MIDI message.
  * @param ticks The tick time of the message.
  * @param a1 Address 1
  * @param a2 Address 2
  * @param a3 Address 3
  * @param data Data, can be multiple bytes.
  */
  static xgMessage(ticks, a1, a2, a3, data) {
    return MIDIMessage.systemExclusive(ticks, this.xg(a1, a2, a3, data));
  }
  /**
  * Gets a raw Device Control System Exclusive message bytes, without the 0xF0 status byte.
  * @param subID The sub ID.
  * @param data Data, can be multiple bytes.
  */
  static deviceControl(subID, data) {
    return [
      127,
      127,
      4,
      subID,
      ...data,
      247
    ];
  }
  /**
  * Gets a Device Control System Exclusive MIDI message.
  * @param ticks The tick time of the message.
  * @param subID The sub ID.
  * @param data Data, can be multiple bytes.
  */
  static deviceControlMessage(ticks, subID, data) {
    return MIDIMessage.systemExclusive(ticks, this.deviceControl(subID, data));
  }
  /**
  * Gets a selected reset System Exclusive MIDI message.
  * @param ticks The tick time of the message.
  * @param system The system to reset into.
  */
  static reset(ticks, system) {
    switch (system) {
      case "gs":
        return this.gsMessage(ticks, 64, 0, 127, [0]);
      case "xg":
        return this.xgMessage(ticks, 0, 0, 126, [0]);
      case "gm":
        return MIDIMessage.systemExclusive(ticks, [
          126,
          127,
          9,
          1,
          127
        ]);
      case "gm2":
        return MIDIMessage.systemExclusive(ticks, [
          126,
          127,
          9,
          3,
          127
        ]);
    }
  }
  static analyzeGM(syx) {
    if (syx.length < 4) return OTHER;
    if (syx[2] === 4) switch (syx[3]) {
      default:
        return OTHER;
      case 1: {
        const value = (syx[5] << 7 | syx[4]) / 16383;
        return {
          type: "Global MIDI Param",
          parameter: "volume",
          value: Math.pow(value, 2)
        };
      }
      case 2:
        return {
          type: "Global MIDI Param",
          parameter: "pan",
          value: ((syx[5] << 7 | syx[4]) - 8192) / 8192
        };
      case 3:
        return {
          type: "Global MIDI Param",
          parameter: "fineTune",
          value: ((syx[5] << 7 | syx[4]) - 8192) / 81.92
        };
      case 4:
        return {
          type: "Global MIDI Param",
          parameter: "keyShift",
          value: syx[5] - 64
        };
      case 5:
        if (syx[4] !== 1 || syx[5] !== 1 || syx[6] !== 1 || syx[7] !== 1) return OTHER;
        switch (syx[8]) {
          default:
            return OTHER;
          case 1:
            switch (syx[9]) {
              default:
                return OTHER;
              case 0:
              case 1:
                return { type: "Reverb Param" };
            }
          case 2:
            switch (syx[9]) {
              default:
                return OTHER;
              case 0:
              case 1:
              case 2:
              case 3:
              case 4:
                return { type: "Chorus Param" };
            }
        }
    }
    if (syx[2] !== 9) return OTHER;
    switch (syx[3]) {
      default:
        return OTHER;
      case 1:
        return {
          type: "Global MIDI Param",
          parameter: "system",
          value: "gm"
        };
      case 2:
        return {
          type: "Global MIDI Param",
          parameter: "system",
          value: "gm"
        };
      case 3:
        return {
          type: "Global MIDI Param",
          parameter: "system",
          value: "gm2"
        };
    }
  }
  static analyzeXG(syx) {
    if (syx[2] !== 76 || syx.length < 7) return OTHER;
    const a1 = syx[3];
    const a2 = syx[4];
    const a3 = syx[5];
    const data = syx[6];
    if (a1 === 6 || a1 === 7) return { type: "Display Data" };
    if (a1 === 0 && a2 === 0) switch (a3) {
      default:
        return OTHER;
      case 0:
        return {
          type: "Global MIDI Param",
          parameter: "fineTune",
          value: (((syx[6] & 15) << 12 | (syx[7] & 15) << 8 | (syx[8] & 15) << 4 | syx[9] & 15) - 1024) / 10
        };
      case 6:
        return {
          type: "Global MIDI Param",
          parameter: "keyShift",
          value: data - 64
        };
      case 126:
      case 127:
        return {
          type: "Global MIDI Param",
          parameter: "system",
          value: "xg"
        };
    }
    if (a1 === 2 && a2 === 1) {
      if (a3 <= 21) return { type: "Reverb Param" };
      if (a3 <= 53) return { type: "Chorus Param" };
      return { type: "Variation Param" };
    }
    if (a1 === 3 && a2 === 0) return { type: "Variation Param" };
    if (a1 === 8) {
      const channel = a2;
      switch (a3) {
        default:
          return OTHER;
        case 1:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.bankSelect,
            value: data
          };
        case 2:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.bankSelectLSB,
            value: data
          };
        case 3:
          return {
            type: "Program Change",
            channel,
            value: data
          };
        case 5:
          return {
            type: "Controller Change",
            channel,
            controller: data === 1 ? MIDIControllers.polyModeOn : MIDIControllers.monoModeOn,
            value: 0
          };
        case 6:
          return {
            type: "Channel MIDI Param",
            channel,
            parameter: "assignMode",
            value: data
          };
        case 7:
          return {
            type: "Drums On",
            channel,
            isDrum: data > 0
          };
        case 8:
          return {
            type: "Channel MIDI Param",
            channel,
            parameter: "keyShift",
            value: data - 64
          };
        case 11:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.mainVolume,
            value: data
          };
        case 14:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.pan,
            value: data
          };
        case 18:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.chorusDepth,
            value: data
          };
        case 19:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.reverbDepth,
            value: data
          };
        case 21:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.vibratoRate,
            value: data
          };
        case 22:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.vibratoDepth,
            value: data
          };
        case 23:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.vibratoDelay,
            value: data
          };
        case 24:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.brightness,
            value: data
          };
        case 25:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.filterResonance,
            value: data
          };
        case 26:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.attackTime,
            value: data
          };
        case 27:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.decayTime,
            value: data
          };
        case 12:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.releaseTime,
            value: data
          };
      }
    }
    if (a1 >> 4 === 3) return { type: "Drum Setup" };
    return OTHER;
  }
  static analyzeGS(syx) {
    if (syx.length < 10 || syx[3] !== 18) return OTHER;
    if (syx[2] === 69) return { type: "Display Data" };
    if (syx[2] !== 66) return OTHER;
    const a1 = syx[4];
    const a2 = syx[5];
    const a3 = syx[6];
    const data = syx[7];
    if ((a1 === 0 || a1 === 64) && a2 === 0) switch (a3) {
      case 0:
        return {
          type: "Global MIDI Param",
          parameter: "fineTune",
          value: ((data << 12 | syx[8] << 8 | syx[9] << 4 | syx[10]) - 1024) / 10
        };
      case 4:
        return {
          type: "Global MIDI Param",
          parameter: "volume",
          value: data / 127
        };
      case 5:
        return {
          type: "Global MIDI Param",
          parameter: "keyShift",
          value: data - 64
        };
      case 6:
        return {
          type: "Global MIDI Param",
          parameter: "pan",
          value: (data - 64) / 63
        };
      case 127:
        switch (data) {
          case 0:
          case 1:
            return {
              type: "Global MIDI Param",
              parameter: "system",
              value: "gs"
            };
          case 127:
            return {
              type: "Global MIDI Param",
              parameter: "system",
              value: "gm"
            };
        }
        return OTHER;
    }
    if (a1 === 65) return { type: "Drum Setup" };
    if (a1 !== 64 && a1 !== 80) return OTHER;
    const channelOffset = a1 === 80 ? 16 : 0;
    if (a2 === 1) {
      if (a3 >= 48 && a3 <= 55) return { type: "Reverb Param" };
      if (a3 >= 56 && a3 <= 64) return { type: "Chorus Param" };
      if (a3 >= 80 && a3 <= 90) return { type: "Delay Param" };
    }
    if (a2 === 3 && a3 >= 0 && a3 <= 127) return { type: "Insertion Param" };
    if (a2 >> 4 === 1) {
      const channel = MIDIUtils2.syxToChannel(a2 & 15) + channelOffset;
      switch (a3) {
        default:
          return OTHER;
        case 0:
          return {
            type: "Program Change",
            channel,
            value: data
          };
        case 19:
          return {
            type: "Channel MIDI Param",
            channel,
            parameter: "polyMode",
            value: data === 1
          };
        case 20:
          return {
            type: "Channel MIDI Param",
            channel,
            parameter: "assignMode",
            value: data
          };
        case 21:
          return {
            type: "Drums On",
            channel,
            isDrum: data > 0
          };
        case 22:
          return {
            type: "Channel MIDI Param",
            channel,
            parameter: "keyShift",
            value: data - 64
          };
        case 25:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.mainVolume,
            value: data
          };
        case 26:
          return {
            type: "Channel MIDI Param",
            channel,
            parameter: "velocitySenseDepth",
            value: data
          };
        case 27:
          return {
            type: "Channel MIDI Param",
            channel,
            parameter: "velocitySenseOffset",
            value: data
          };
        case 28:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.pan,
            value: data
          };
        case 31:
          return {
            type: "Channel MIDI Param",
            channel,
            parameter: "cc1",
            value: data
          };
        case 32:
          return {
            type: "Channel MIDI Param",
            channel,
            parameter: "cc2",
            value: data
          };
        case 33:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.chorusDepth,
            value: data
          };
        case 34:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.reverbDepth,
            value: data
          };
        case 42:
          return {
            type: "Channel MIDI Param",
            channel,
            parameter: "fineTune",
            value: ((data << 7 | syx[8]) - 8192) / 81.92
          };
        case 44:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.variationDepth,
            value: data
          };
        case 48:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.vibratoRate,
            value: data
          };
        case 49:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.vibratoDepth,
            value: data
          };
        case 50:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.brightness,
            value: data
          };
        case 51:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.filterResonance,
            value: data
          };
        case 52:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.attackTime,
            value: data
          };
        case 53:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.decayTime,
            value: data
          };
        case 54:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.releaseTime,
            value: data
          };
        case 55:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.vibratoDelay,
            value: data
          };
      }
    }
    if (a2 >> 4 === 4) {
      const channel = MIDIUtils2.syxToChannel(a2 & 15) + channelOffset;
      switch (a3) {
        default:
          return OTHER;
        case 0:
        case 1:
          return {
            type: "Controller Change",
            channel,
            controller: MIDIControllers.bankSelectLSB,
            value: data
          };
        case 34:
          return {
            type: "Channel MIDI Param",
            channel,
            parameter: "efxAssign",
            value: data === 1
          };
      }
    }
    return OTHER;
  }
};
var DEFAULT_COPYRIGHT = "Created using SpessaSynth";
function correctBankOffsetInternal(mid, bankOffset, soundBank) {
  let system = "gm";
  const unwantedSystems = [];
  const ports = new Array(mid.tracks.length).fill(0);
  const channelsAmount = 16 + Math.max(...mid.portChannelOffsetMap);
  const channels = [];
  for (let i = 0; i < channelsAmount; i++) channels.push({
    program: 0,
    isDrum: i % 16 === 9,
    lastBank: void 0,
    lastBankLSB: void 0,
    hasBankSelect: false
  });
  mid.iterate((e, trackNum, eventIndexes) => {
    const portOffset = mid.portChannelOffsetMap[ports[trackNum]];
    if (e.statusByte === MIDIMessageTypes.midiPort) {
      ports[trackNum] = e.data[0];
      return;
    }
    const status = e.statusByte & 240;
    if (status !== MIDIMessageTypes.controllerChange && status !== MIDIMessageTypes.programChange && status !== MIDIMessageTypes.systemExclusive) return;
    if (status === MIDIMessageTypes.systemExclusive) {
      const syx = MIDIUtils.analyzeSysEx(e.data);
      switch (syx.type) {
        default:
          return;
        case "Drums On": {
          const sysexChannel = syx.channel + portOffset;
          if (!channels[sysexChannel]) return;
          channels[sysexChannel].isDrum = syx.isDrum;
          return;
        }
        case "Global MIDI Param":
          if (syx.parameter === "system") {
            system = syx.value;
            if (syx.value === "gm") unwantedSystems.push({
              tNum: trackNum,
              e
            });
          }
          break;
        case "Controller Change": {
          const t = mid.tracks[trackNum];
          if (syx.channel >= 16) return;
          const newEvent = MIDIMessage.controllerChange(e.ticks, syx.channel, syx.controller, syx.value);
          t.events[eventIndexes[trackNum]] = newEvent;
          e = newEvent;
          SpessaLog.info("%cReplaced a system exclusive with controller change!", ConsoleColors.info);
          break;
        }
        case "Program Change": {
          if (syx.channel >= 16) return;
          const t = mid.tracks[trackNum];
          const newEvent = MIDIMessage.programChange(e.ticks, syx.channel, syx.value);
          t.events[eventIndexes[trackNum]] = newEvent;
          e = newEvent;
          SpessaLog.info("%cReplaced a system exclusive with program change!", ConsoleColors.info);
          break;
        }
      }
    }
    const chNum = (e.statusByte & 15) + portOffset;
    const ch = channels[chNum];
    if (status === MIDIMessageTypes.programChange) {
      const patch = {
        program: e.data[0],
        bankLSB: ch.lastBankLSB?.data?.[1] ?? 0,
        bankMSB: BankSelectHacks.subtractBankOffset(ch.lastBank?.data?.[1] ?? 0, mid.bankOffset, system === "xg"),
        isGMGSDrum: ch.isDrum
      };
      const targetPreset = soundBank.getPreset(patch, system);
      SpessaLog.info(`%cInput patch: %c${MIDIPatchTools.toMIDIString(patch)}%c. Channel %c${chNum}%c. Changing patch to ${targetPreset.toString()}.`, ConsoleColors.info, ConsoleColors.unrecognized, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info);
      e.data[0] = targetPreset.program;
      if (targetPreset.isGMGSDrum && BankSelectHacks.isSystemXG(system)) return;
      if (ch.lastBank === void 0) return;
      ch.lastBank.data[1] = BankSelectHacks.addBankOffset(targetPreset.bankMSB, bankOffset, system === "xg");
      if (ch.lastBankLSB === void 0) return;
      ch.lastBankLSB.data[1] = targetPreset.bankLSB;
      return;
    }
    const isLSB = e.data[0] === MIDIControllers.bankSelectLSB;
    if (e.data[0] !== MIDIControllers.bankSelect && !isLSB) return;
    ch.hasBankSelect = true;
    if (isLSB) ch.lastBankLSB = e;
    else ch.lastBank = e;
  });
  for (let chNum = 0; chNum < channels.length; chNum++) {
    const ch = channels[chNum];
    if (ch.hasBankSelect) continue;
    const midiChannel = chNum % 16;
    const status = MIDIMessageTypes.programChange | midiChannel;
    const portOffset = Math.floor(chNum / 16) * 16;
    const port = mid.portChannelOffsetMap.indexOf(portOffset);
    const track = mid.tracks.find((t) => t.port === port && t.channels.has(midiChannel));
    if (track === void 0) continue;
    let indexToAdd = track.events.findIndex((e) => e.statusByte === status);
    if (indexToAdd === -1) {
      const programIndex = track.events.findIndex((e) => e.statusByte > 128 && e.statusByte < 240 && (e.statusByte & 15) === midiChannel);
      if (programIndex === -1) continue;
      const programTicks = track.events[programIndex].ticks;
      const targetProgram = soundBank.getPreset({
        bankMSB: 0,
        bankLSB: 0,
        program: 0,
        isGMGSDrum: false
      }, system).program;
      track.addEvents(programIndex, MIDIMessage.programChange(programTicks, midiChannel, targetProgram));
      indexToAdd = programIndex;
    }
    SpessaLog.info(`%cAdding bank select for %c${chNum}`, ConsoleColors.info, ConsoleColors.recognized);
    const ticks = track.events[indexToAdd].ticks;
    const targetPreset = soundBank.getPreset({
      bankLSB: 0,
      bankMSB: 0,
      program: ch.program,
      isGMGSDrum: ch.isDrum
    }, system);
    const targetBank = BankSelectHacks.addBankOffset(targetPreset.bankMSB, bankOffset, system === "xg");
    track.addEvents(indexToAdd, MIDIMessage.controllerChange(ticks, midiChannel, MIDIControllers.bankSelect, targetBank));
  }
  if (system === "gm" && !BankSelectHacks.isSystemXG(system)) {
    for (const m of unwantedSystems) {
      const track = mid.tracks[m.tNum];
      track.deleteEvent(track.events.indexOf(m.e));
    }
    let index = 0;
    if (mid.tracks[0].events[0].statusByte === MIDIMessageTypes.trackName) index++;
    mid.tracks[0].addEvents(index, MIDIUtils.reset(0, "gs"));
  }
  mid.flush();
}
var DEFAULT_RMIDI_WRITE_OPTIONS = {
  bankOffset: 0,
  metadata: {},
  correctBankOffset: true,
  soundBank: void 0
};
function writeRMIDIInternal(mid, soundBankBinary, options) {
  const metadata = options.metadata;
  SpessaLog.group("%cWriting the RMIDI File...", ConsoleColors.info);
  SpessaLog.info("metadata", metadata);
  SpessaLog.info("Initial bank offset", mid.bankOffset);
  if (options.correctBankOffset) {
    if (!options.soundBank) throw new Error("Sound bank must be provided if correcting bank offset.");
    correctBankOffsetInternal(mid, options.bankOffset, options.soundBank);
  }
  const newMid = new IndexedByteArray(mid.writeMIDI());
  metadata.name ??= mid.getName();
  metadata.creationDate ??= /* @__PURE__ */ new Date();
  metadata.copyright ??= DEFAULT_COPYRIGHT;
  metadata.software ??= "SpessaSynth";
  Object.entries(metadata).forEach((v) => {
    const val = v;
    if (val[1]) mid.setRMIDInfo(val[0], val[1]);
  });
  const infoContent = [];
  const writeInfo = (type, data) => {
    infoContent.push(RIFFChunk.write(type, data));
  };
  for (const v of Object.entries(mid.rmidiInfo)) {
    const type = v[0];
    const data = v[1];
    switch (type) {
      case "album":
        writeInfo("IALB", data);
        writeInfo("IPRD", data);
        break;
      case "software":
        writeInfo("ISFT", data);
        break;
      case "infoEncoding":
        writeInfo("IENC", data);
        break;
      case "creationDate":
        writeInfo("ICRD", data);
        break;
      case "picture":
        writeInfo("IPIC", data);
        break;
      case "name":
        writeInfo("INAM", data);
        break;
      case "artist":
        writeInfo("IART", data);
        break;
      case "genre":
        writeInfo("IGNR", data);
        break;
      case "copyright":
        writeInfo("ICOP", data);
        break;
      case "comment":
        writeInfo("ICMT", data);
        break;
      case "engineer":
        writeInfo("IENG", data);
        break;
      case "subject":
        writeInfo("ISBJ", data);
        break;
      case "midiEncoding":
        writeInfo("MENC", data);
        break;
    }
  }
  const DBNK = new IndexedByteArray(2);
  writeLittleEndianIndexed(DBNK, options.bankOffset, 2);
  infoContent.push(RIFFChunk.write("DBNK", DBNK));
  SpessaLog.info("%cFinished!", ConsoleColors.info);
  SpessaLog.groupEnd();
  return RIFFChunk.writeParts("RIFF", [
    getStringBytes("RMID"),
    RIFFChunk.write("data", newMid),
    RIFFChunk.writeParts("INFO", infoContent, true),
    new IndexedByteArray(soundBankBinary)
  ]).buffer;
}
var ParameterTracker = class {
  rpnMSB = {
    v: 127,
    track: 0,
    event: 0
  };
  rpnLSB = {
    v: 127,
    track: 0,
    event: 0
  };
  nrpnMSB = {
    v: 0,
    track: 0,
    event: 0
  };
  nrpnLSB = {
    v: 0,
    track: 0,
    event: 0
  };
  dataMSB = {
    v: 0,
    track: 0,
    event: 0
  };
  dataLSB = {
    v: 0,
    track: 0,
    event: 0
  };
  channel;
  isRegistered = true;
  constructor(channel) {
    this.channel = channel;
  }
  get paramMSB() {
    return this.isRegistered ? this.rpnMSB : this.nrpnMSB;
  }
  get paramLSB() {
    return this.isRegistered ? this.rpnLSB : this.nrpnLSB;
  }
  reset() {
    this.isRegistered = true;
    this.rpnLSB.v = 127;
    this.rpnMSB.v = 127;
    this.nrpnMSB.v = 0;
    this.nrpnLSB.v = 0;
    this.resetData();
  }
  controllerChange(cc, v, track, event) {
    switch (cc) {
      case MIDIControllers.registeredParameterMSB:
        this.resetData();
        this.isRegistered = true;
        this.rpnMSB = {
          v,
          track,
          event
        };
        break;
      case MIDIControllers.registeredParameterLSB:
        this.resetData();
        this.isRegistered = true;
        this.rpnLSB = {
          v,
          track,
          event
        };
        break;
      case MIDIControllers.nonRegisteredParameterMSB:
        this.resetData();
        this.isRegistered = false;
        this.nrpnMSB = {
          v,
          track,
          event
        };
        break;
      case MIDIControllers.nonRegisteredParameterLSB:
        this.resetData();
        this.isRegistered = false;
        this.nrpnLSB = {
          v,
          track,
          event
        };
        break;
      case MIDIControllers.dataEntryMSB:
        this.dataMSB = {
          v,
          track,
          event
        };
        return this.analyze();
      case MIDIControllers.dataEntryLSB:
        this.dataLSB = {
          v,
          track,
          event
        };
        return this.analyze();
    }
  }
  resetData() {
    this.dataLSB.v = 0;
    this.dataMSB.v = 0;
  }
  analyze() {
    const v = this.dataMSB.v << 7 | this.dataLSB.v;
    return this.isRegistered ? MIDIUtils.analyzeRPN(this.channel, this.rpnMSB.v << 7 | this.rpnLSB.v, v) : MIDIUtils.analyzeNRPN(this.channel, this.nrpnMSB.v << 7 | this.nrpnLSB.v, v);
  }
};
function getUsedProgramsAndKeys(mid, soundBank) {
  SpessaLog.groupCollapsed("%cSearching for all used programs and keys...", ConsoleColors.info);
  const channelsAmount = 16 + Math.max(...mid.portChannelOffsetMap);
  const channels = [];
  let system = "gs";
  let masterKeyShift = 0;
  const reset = (sys) => {
    system = sys;
    masterKeyShift = 0;
    for (let i = 0; i < channelsAmount; i++) {
      const ch = channels[i];
      ch.isDrum = i % 16 === 9;
      ch.bankMSB = BankSelectHacks.getDefaultBank(sys);
      ch.bankLSB = 0;
      ch.keyShift = 0;
      ch.param.reset();
    }
  };
  for (let i = 0; i < channelsAmount; i++) {
    const isDrum = i % 16 === 9;
    channels.push({
      preset: soundBank.getPreset({
        bankLSB: 0,
        bankMSB: 0,
        isGMGSDrum: isDrum,
        program: 0
      }, system),
      bankMSB: 0,
      bankLSB: 0,
      param: new ParameterTracker(i),
      isDrum,
      keyShift: 0
    });
  }
  const usedProgramsAndKeys = /* @__PURE__ */ new Map();
  const ports = mid.tracks.map((t) => t.port);
  const offsetMap = mid.portChannelOffsetMap;
  const { timeline, tracks } = mid;
  for (const t of timeline) {
    const trackNum = t.tr;
    const event = t.ev;
    const e = tracks[trackNum].events[event];
    if (e.statusByte === MIDIMessageTypes.midiPort && mid.tracks[trackNum].channels.size > 0) {
      let port = e.data[0];
      if (offsetMap[port] === void 0) {
        SpessaLog.warn(`Invalid port ${port} on track ${trackNum}. (No offset found in the MIDI map.`);
        port = 0;
      }
      ports[trackNum] = port;
      continue;
    }
    const status = e.statusByte & 240;
    if (status !== MIDIMessageTypes.noteOn && status !== MIDIMessageTypes.controllerChange && status !== MIDIMessageTypes.programChange && status !== MIDIMessageTypes.systemExclusive) continue;
    const channelOffset = offsetMap[ports[trackNum]] || 0;
    switch (status) {
      case MIDIMessageTypes.programChange: {
        const ch = channels[(e.statusByte & 15) + channelOffset];
        ch.preset = soundBank.getPreset({
          bankMSB: ch.bankMSB,
          bankLSB: ch.bankLSB,
          program: e.data[0],
          isGMGSDrum: ch.isDrum
        }, system);
        break;
      }
      case MIDIMessageTypes.controllerChange: {
        const ch = channels[(e.statusByte & 15) + channelOffset];
        const cc = e.data[0];
        const value = e.data[1];
        switch (cc) {
          case MIDIControllers.registeredParameterMSB:
          case MIDIControllers.registeredParameterLSB:
          case MIDIControllers.nonRegisteredParameterLSB:
          case MIDIControllers.nonRegisteredParameterMSB:
            ch.param.controllerChange(cc, value, trackNum, event);
            break;
          case MIDIControllers.dataEntryMSB:
          case MIDIControllers.dataEntryLSB: {
            const analyzed = ch.param.controllerChange(cc, value, trackNum, event);
            if (analyzed?.type === "Channel MIDI Param" && analyzed.parameter === "keyShift") ch.keyShift = ch.isDrum ? 0 : analyzed.value;
            break;
          }
          case MIDIControllers.resetAllControllers:
            ch.param.reset();
            break;
          case MIDIControllers.bankSelect:
            ch.bankMSB = value;
            break;
          case MIDIControllers.bankSelectLSB:
            ch.bankLSB = value;
            break;
        }
        break;
      }
      case MIDIMessageTypes.noteOn: {
        const ch = channels[(e.statusByte & 15) + channelOffset];
        if (e.data[1] === 0) continue;
        if (!ch.preset) continue;
        let keysForPreset = usedProgramsAndKeys.get(ch.preset);
        if (!keysForPreset) {
          keysForPreset = /* @__PURE__ */ new Map();
          usedProgramsAndKeys.set(ch.preset, keysForPreset);
        }
        const midiNote = e.data[0] + (ch.isDrum ? 0 : masterKeyShift) + ch.keyShift;
        let velocities = keysForPreset.get(midiNote);
        if (!velocities) {
          velocities = /* @__PURE__ */ new Set();
          keysForPreset.set(midiNote, velocities);
        }
        velocities.add(e.data[1]);
        break;
      }
      case MIDIMessageTypes.systemExclusive: {
        const syx = MIDIUtils.analyzeSysEx(e.data);
        switch (syx.type) {
          default:
            break;
          case "Global MIDI Param":
            if (syx.parameter === "keyShift") masterKeyShift = syx.value;
            else if (syx.parameter === "system") {
              reset(syx.value);
              SpessaLog.info(`%c${syx.value.toUpperCase()} on detected!`, ConsoleColors.recognized);
            }
            break;
          case "Channel MIDI Param":
            if (syx.parameter === "keyShift") {
              const ch = channels[syx.channel];
              if (!ch) break;
              ch.keyShift = ch.isDrum ? 0 : syx.value;
            }
            break;
          case "Drums On": {
            const sysexChannel = syx.channel + channelOffset;
            if (!channels[sysexChannel]) break;
            channels[sysexChannel].isDrum = syx.isDrum;
            break;
          }
          case "Program Change": {
            const ch = channels[syx.channel + channelOffset];
            if (!ch) break;
            ch.preset = soundBank.getPreset({
              bankMSB: ch.bankMSB,
              bankLSB: ch.bankLSB,
              program: syx.value,
              isGMGSDrum: ch.isDrum
            }, system);
            break;
          }
          case "Controller Change": {
            const ch = channels[syx.channel + channelOffset];
            if (!ch) break;
            if (syx.controller === MIDIControllers.bankSelectLSB) ch.bankLSB = syx.value;
            else if (syx.controller === MIDIControllers.bankSelect) ch.bankMSB = syx.value;
          }
        }
      }
    }
  }
  for (const [preset, keysForPreset] of usedProgramsAndKeys.entries()) if (keysForPreset.size === 0) {
    SpessaLog.info(`%cDetected change but no keys for %c${preset.name}`, ConsoleColors.info, ConsoleColors.value);
    usedProgramsAndKeys.delete(preset);
  }
  SpessaLog.groupEnd();
  return usedProgramsAndKeys;
}
var getTempo = (event) => {
  event.data = new IndexedByteArray(event.data.buffer);
  return 6e7 / readBigEndian(event.data, 3);
};
function getNoteTimesInternal(midi, minDrumLength = 0) {
  const noteTimes = [];
  for (let i2 = 0; i2 < 16; i2++) noteTimes.push([]);
  let elapsedTime = 0;
  let oneTickToSeconds = 60 / (120 * midi.timeDivision);
  let i = 0;
  let unfinished = 0;
  const unfinishedNotes = [];
  for (let i2 = 0; i2 < 16; i2++) unfinishedNotes.push(/* @__PURE__ */ new Map());
  const noteOff2 = (midiNote, channel) => {
    const noteIndexes = unfinishedNotes[channel].get(midiNote);
    if (noteIndexes === void 0) return;
    const noteIndex = noteIndexes.shift();
    if (noteIndex === void 0) return;
    const note = noteTimes[channel][noteIndex];
    const time = elapsedTime - note.start;
    note.length = channel === 9 ? Math.max(time, minDrumLength) : time;
    unfinished--;
  };
  const { timeline, tracks } = midi;
  while (i < timeline.length) {
    const e = timeline[i];
    const event = tracks[e.tr].events[e.ev];
    const status = event.statusByte >> 4;
    const channel = event.statusByte & 15;
    if (status === 8) noteOff2(event.data[0], channel);
    else if (status === 9) {
      const midiNote = event.data[0];
      const velocity = event.data[1];
      if (velocity === 0) noteOff2(midiNote, channel);
      else {
        const noteTime = {
          midiNote,
          start: elapsedTime,
          length: -1,
          velocity
        };
        const times = noteTimes[channel];
        times.push(noteTime);
        const unfinishedChannel = unfinishedNotes[channel];
        if (!unfinishedChannel.has(midiNote)) unfinishedChannel.set(midiNote, []);
        unfinishedNotes[channel].get(midiNote)?.push(times.length - 1);
        unfinished++;
      }
    } else if (event.statusByte === 81) oneTickToSeconds = 60 / (getTempo(event) * midi.timeDivision);
    if (++i >= timeline.length) break;
    const nextTimeline = timeline[i];
    elapsedTime += oneTickToSeconds * (tracks[nextTimeline.tr].events[nextTimeline.ev].ticks - event.ticks);
  }
  if (unfinished > 0) for (let channel = 0; channel < unfinishedNotes.length; channel++) for (const noteIndexes of unfinishedNotes[channel].values()) for (const noteIndex of noteIndexes) {
    const note = noteTimes[channel][noteIndex];
    note.length = elapsedTime - note.start;
  }
  return noteTimes;
}
var reverbAddressMap = {
  character: 49,
  preLowpass: 50,
  level: 51,
  time: 52,
  delayFeedback: 53,
  preDelayTime: 55
};
var chorusAddressMap = {
  preLowpass: 57,
  level: 58,
  feedback: 59,
  delay: 60,
  rate: 61,
  depth: 62,
  sendLevelToReverb: 63,
  sendLevelToDelay: 64
};
var delayAddressMap = {
  preLowpass: 81,
  timeCenter: 82,
  timeRatioLeft: 83,
  timeRatioRight: 84,
  levelCenter: 85,
  levelLeft: 86,
  levelRight: 87,
  level: 88,
  feedback: 89,
  sendLevelToReverb: 90
};
function modifyMIDIInternal(midi, opts) {
  SpessaLog.groupCollapsed("%cApplying changes to the MIDI file...", ConsoleColors.info);
  const { channels, reverbParams, chorusParams, delayParams, insertionParams } = opts;
  SpessaLog.info("Desired channel changes", channels);
  SpessaLog.info("Desired reverb parameters", reverbParams);
  SpessaLog.info("Desired chorus parameters", chorusParams);
  SpessaLog.info("Desired delay parameters", delayParams);
  SpessaLog.info("Desired insertion parameters", insertionParams);
  const clearDrumParams = opts.drumSetupParams === "clear";
  const clearedChannels = /* @__PURE__ */ new Set();
  const channelChanges = /* @__PURE__ */ new Map();
  if (channels) for (const [channel, ch] of channels) if (ch === "clear") clearedChannels.add(channel);
  else channelChanges.set(channel, ch);
  let system = (opts.midiParams?.system === "clear" ? void 0 : opts.midiParams?.system) ?? "gs";
  let addedReset = false;
  let resetTrack = 0;
  let resetIndex = 0;
  const midiPorts = midi.tracks.map((t) => t.port);
  const midiPortChannelOffsets = {};
  let midiPortChannelOffset = 0;
  const assignMIDIPort = (trackNum, port) => {
    if (midi.tracks[trackNum].channels.size === 0) return;
    if (midiPortChannelOffset === 0) {
      midiPortChannelOffset += 16;
      midiPortChannelOffsets[port] = 0;
    }
    if (midiPortChannelOffsets[port] === void 0) {
      midiPortChannelOffsets[port] = midiPortChannelOffset;
      midiPortChannelOffset += 16;
    }
    midiPorts[trackNum] = port;
  };
  for (const [i, track] of midi.tracks.entries()) assignMIDIPort(i, track.port);
  const channelsAmount = midiPortChannelOffset;
  const channelStatuses = [];
  for (let i = 0; i < channelsAmount; i++) channelStatuses.push({
    isFirstNoteOn: true,
    param: new ParameterTracker(i),
    clearedParams: {
      pLSB: true,
      pMSB: true,
      data: true
    },
    keyShift: channelChanges.get(i)?.keyShift ?? 0,
    fineTune: channelChanges.get(i)?.fineTune ?? 0,
    currentFineTune: 0,
    currentKeyShift: 0
  });
  midi.iterate((e, trackNum, eventIndexes) => {
    const track = midi.tracks[trackNum];
    const index = eventIndexes[trackNum];
    const deleteThisEvent = () => {
      track.deleteEvent(index);
      eventIndexes[trackNum]--;
    };
    const deleteParameter = (channel2) => {
      const ch = channelStatuses[channel2];
      const p = ch.param;
      const msb = p.paramMSB;
      const lsb = p.paramLSB;
      SpessaLog.info(`%cClearing Non/Registered Parameter on ${channel2}. Clear MSB: %c${ch.clearedParams.pMSB}%c, clear LSB: %c${ch.clearedParams.pLSB}%c, clear data: %c${ch.clearedParams.data}.`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized);
      if (!ch.clearedParams.data) {
        deleteThisEvent();
        if (trackNum === msb.track && index < msb.event) msb.event--;
        if (trackNum === lsb.track && index < lsb.event) lsb.event--;
        ch.clearedParams.data = true;
      }
      if (!ch.clearedParams.pMSB) {
        midi.tracks[msb.track].deleteEvent(msb.event);
        eventIndexes[msb.track]--;
        if (msb.track === lsb.track && msb.event < lsb.event) lsb.event--;
        ch.clearedParams.pMSB = true;
      }
      if (!ch.clearedParams.pLSB) {
        midi.tracks[lsb.track].deleteEvent(lsb.event);
        eventIndexes[lsb.track]--;
        ch.clearedParams.pLSB = true;
      }
    };
    const addEventBefore = (e2) => {
      track.addEvents(index, e2);
      eventIndexes[trackNum]++;
    };
    const addEventsBefore = (...events) => {
      for (let i = events.length - 1; i >= 0; i--) addEventBefore(events[i]);
    };
    const portOffset = midiPortChannelOffsets[midiPorts[trackNum]] || 0;
    if (e.statusByte === MIDIMessageTypes.midiPort) {
      assignMIDIPort(trackNum, e.data[0]);
      return;
    }
    if (e.statusByte < MIDIMessageTypes.noteOff || e.statusByte > MIDIMessageTypes.systemExclusive) return;
    const status = e.statusByte & 240;
    const midiChannel = e.statusByte & 15;
    const channel = midiChannel + portOffset;
    if (e.statusByte !== MIDIMessageTypes.systemExclusive && clearedChannels.has(channel)) {
      deleteThisEvent();
      return;
    }
    const channelStatus = channelStatuses[channel];
    const channelChange = channelChanges.get(channel);
    switch (status) {
      case MIDIMessageTypes.noteOn:
        if (!channelChange) break;
        if (channelStatus.isFirstNoteOn) {
          channelStatus.isFirstNoteOn = false;
          if (channelChange.controllers) for (const [cc, value] of channelChange.controllers) {
            if (value === "clear") continue;
            addEventBefore(MIDIMessage.controllerChange(e.ticks, midiChannel, cc, value));
          }
          if (channelChange.midiParams?.fineTune !== void 0 && channelChange.midiParams.fineTune !== "clear") {
            const newTune = channelStatus.fineTune + channelChange.midiParams.fineTune;
            channelStatus.currentKeyShift = Math.trunc(newTune / 100);
            channelChange.midiParams.fineTune = newTune % 100;
          } else {
            const newTune = channelStatus.fineTune + channelStatus.currentFineTune;
            channelStatus.currentKeyShift = Math.trunc(newTune / 100);
            channelChange.midiParams ??= {};
            channelChange.midiParams.fineTune = newTune % 100;
          }
          const patch = channelChange.patch;
          if (patch && patch !== "clear") {
            SpessaLog.info(`%cSetting %c${channel}%c to %c${MIDIPatchTools.toMIDIString(patch)}%c. Track num: %c${trackNum}`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized);
            let desiredBankMSB = patch.bankMSB;
            let desiredBankLSB = patch.bankLSB;
            const desiredProgram = patch.program;
            addEventBefore(MIDIMessage.programChange(e.ticks, midiChannel, desiredProgram));
            const addBank = (isLSB, v) => {
              addEventBefore(MIDIMessage.controllerChange(e.ticks, midiChannel, isLSB ? MIDIControllers.bankSelectLSB : MIDIControllers.bankSelect, v));
            };
            if (BankSelectHacks.isSystemXG(system) && patch.isGMGSDrum) {
              SpessaLog.info(`%cAdding XG Drum change on track %c${trackNum}`, ConsoleColors.recognized, ConsoleColors.value);
              desiredBankMSB = BankSelectHacks.getDrumBank(system);
              desiredBankLSB = 0;
            }
            addBank(false, desiredBankMSB);
            addBank(true, desiredBankLSB);
            if (patch.isGMGSDrum && !BankSelectHacks.isSystemXG(system) && midiChannel !== 9) {
              SpessaLog.info(`%cAdding GS Drum change on track %c${trackNum}`, ConsoleColors.recognized, ConsoleColors.value);
              const chanAddress = 16 | MIDIUtils.channelToSyx(midiChannel);
              addEventBefore(MIDIUtils.gsMessage(e.ticks, 40, chanAddress, 21, [1]));
            }
          }
          if (channelChange.midiParams) for (const [param, value] of Object.entries(channelChange.midiParams)) {
            if (value === "clear") continue;
            addEventsBefore(...MIDIUtils.setChannelMIDIParameter(e.ticks, midiChannel, system, param, value));
          }
        }
        e.data[0] += channelStatus.keyShift + channelStatus.currentKeyShift;
        break;
      case MIDIMessageTypes.noteOff:
        if (!channelChange) break;
        e.data[0] += channelStatus.keyShift + channelStatus.currentKeyShift;
        break;
      case MIDIMessageTypes.programChange:
        if (channelChange?.patch) {
          deleteThisEvent();
          return;
        }
        break;
      case MIDIMessageTypes.pitchWheel:
        if (channelChange?.midiParams?.pitchWheel) deleteThisEvent();
        break;
      case MIDIMessageTypes.channelPressure:
        if (channelChange?.midiParams?.pressure) deleteThisEvent();
        break;
      case MIDIMessageTypes.controllerChange: {
        const ccNum = e.data[0];
        const value = e.data[1];
        if (channelChange?.controllers?.get(ccNum)) {
          deleteThisEvent();
          return;
        }
        switch (ccNum) {
          case MIDIControllers.bankSelect:
          case MIDIControllers.bankSelectLSB:
            if (channelChange?.patch) deleteThisEvent();
            return;
          case MIDIControllers.registeredParameterLSB:
          case MIDIControllers.registeredParameterMSB:
          case MIDIControllers.nonRegisteredParameterMSB:
          case MIDIControllers.nonRegisteredParameterLSB:
            if (ccNum === MIDIControllers.nonRegisteredParameterLSB || ccNum === MIDIControllers.registeredParameterLSB) channelStatus.clearedParams.pLSB = false;
            else channelStatus.clearedParams.pMSB = false;
            channelStatus.param.controllerChange(ccNum, value, trackNum, index);
            return;
          case MIDIControllers.dataEntryMSB:
          case MIDIControllers.dataEntryLSB: {
            channelStatus.clearedParams.data = false;
            const data = channelStatus.param.controllerChange(ccNum, value, trackNum, index);
            if (!data) return;
            switch (data.type) {
              case "Drum Setup":
                if (clearDrumParams) deleteParameter(channel);
                return;
              case "Controller Change": {
                const ccNum2 = data.controller;
                const channel2 = data.channel;
                if (channelChange?.controllers?.get(ccNum2)) {
                  deleteParameter(channel2);
                  return;
                }
                if ((ccNum2 === MIDIControllers.bankSelect || ccNum2 === MIDIControllers.bankSelectLSB) && channelChange?.patch) deleteParameter(channel2);
                break;
              }
              case "Channel MIDI Param":
                if (data.parameter === "fineTune" && channelStatus.fineTune) {
                  channelStatus.currentFineTune = data.value;
                  const newTune = channelStatus.fineTune + data.value;
                  channelStatus.currentKeyShift = Math.trunc(newTune / 100);
                  const targetTune = newTune % 100;
                  SpessaLog.info(`%cFine tuning already present on ${channel}%c (${data.value})%c, new relative tune: %c${newTune}%c cents. Key shift: %c${channelStatus.currentKeyShift}%c semitones. Actual RPN value to set: %c${targetTune} cents.`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.value, ConsoleColors.info, ConsoleColors.value, ConsoleColors.info, ConsoleColors.value);
                  const updatedData = Math.floor(targetTune * 81.92) + 8192;
                  e.data[1] = ccNum === MIDIControllers.dataEntryMSB ? updatedData >> 7 : updatedData & 127;
                } else if (channelChange?.midiParams?.[data.parameter]) deleteParameter(channel);
                break;
            }
            channelStatus.clearedParams.pLSB = true;
            channelStatus.clearedParams.pMSB = true;
            return;
          }
          default:
            return;
        }
      }
      case MIDIMessageTypes.systemExclusive: {
        const syx = MIDIUtils.analyzeSysEx(e.data);
        switch (syx.type) {
          default:
            return;
          case "Drum Setup":
            if (clearDrumParams) deleteThisEvent();
            return;
          case "Reverb Param":
            if (reverbParams) deleteThisEvent();
            return;
          case "Chorus Param":
            if (chorusParams) deleteThisEvent();
            return;
          case "Delay Param":
            if (delayParams) deleteThisEvent();
            return;
          case "Insertion Param":
            if (insertionParams) deleteThisEvent();
            return;
          case "Program Change":
            if (channelChanges.get(syx.channel + portOffset)?.patch) deleteThisEvent();
            return;
          case "Global MIDI Param":
            if (opts.midiParams?.[syx.parameter]) {
              deleteThisEvent();
              return;
            }
            if (syx.parameter === "system") switch (syx.value) {
              case "xg":
                SpessaLog.info("%cXG system on detected", ConsoleColors.info);
                system = "xg";
                addedReset = true;
                resetTrack = trackNum;
                resetIndex = index;
                for (const ch of channelStatuses) {
                  ch.param.reset();
                  ch.clearedParams = {
                    pLSB: true,
                    pMSB: true,
                    data: true
                  };
                }
                return;
              case "gm2":
                SpessaLog.info("%cGM2 system on detected", ConsoleColors.info);
                system = "gm2";
                addedReset = true;
                resetTrack = trackNum;
                resetIndex = index;
                for (const ch of channelStatuses) {
                  ch.param.reset();
                  ch.clearedParams = {
                    pLSB: true,
                    pMSB: true,
                    data: true
                  };
                }
                return;
              case "gs":
                SpessaLog.info("%cGS on detected!", ConsoleColors.recognized);
                addedReset = true;
                resetTrack = trackNum;
                resetIndex = index;
                for (const ch of channelStatuses) {
                  ch.param.reset();
                  ch.clearedParams = {
                    pLSB: true,
                    pMSB: true,
                    data: true
                  };
                }
                return;
              case "gm":
                SpessaLog.info("%cGM on detected, removing!", ConsoleColors.info);
                deleteThisEvent();
                addedReset = false;
                return;
            }
            break;
          case "Channel MIDI Param": {
            const syxChannel = channelChanges.get(syx.channel + portOffset);
            if (syxChannel?.midiParams?.[syx.parameter]) {
              deleteThisEvent();
              return;
            }
            if (syx.parameter === "fineTune") {
              const syxStatus = channelStatuses[syx.channel + portOffset];
              if (syxStatus && syxStatus.isFirstNoteOn && syxChannel) {
                const newTune = syxStatus.fineTune + syx.value;
                syxStatus.currentKeyShift = Math.trunc(newTune / 100);
                syxStatus.fineTune = newTune % 100;
                SpessaLog.info(`%cFine tuning already present on ${syx.channel + portOffset}, new relative tune: %c${newTune} cents`, ConsoleColors.info, ConsoleColors.recognized);
                deleteThisEvent();
              }
              break;
            }
            break;
          }
          case "Controller Change": {
            const ccNum = syx.controller;
            const syxChannel = channelChanges.get(syx.channel + portOffset);
            if (syxChannel?.controllers?.get(ccNum) !== void 0) {
              deleteThisEvent();
              return;
            }
            if ((ccNum === MIDIControllers.bankSelect || ccNum === MIDIControllers.bankSelectLSB) && syxChannel?.patch) deleteThisEvent();
            return;
          }
        }
      }
    }
  });
  if (!addedReset && [...channelChanges.values()].some((c) => c.patch && c.patch !== "clear")) {
    let index = 0;
    if (midi.tracks[0].events[0].statusByte === MIDIMessageTypes.trackName) index++;
    const targetSystem = (opts.midiParams?.system === "clear" ? void 0 : opts.midiParams?.system) ?? "gs";
    midi.tracks[0].addEvents(index, MIDIUtils.reset(0, targetSystem));
    resetTrack = 0;
    resetIndex = index;
    system = targetSystem;
    SpessaLog.info(`%c${targetSystem} reset on not detected. Adding it.`, ConsoleColors.info);
  }
  const targetTicks = Math.max(0, midi.firstNoteOn);
  const targetTrack = midi.tracks[resetTrack];
  const targetIndex = resetIndex + 1;
  for (const param of Object.keys(opts.midiParams ?? {})) {
    if (param === "system") continue;
    const value = opts.midiParams?.[param];
    if (!value || value === "clear") continue;
    targetTrack.addEvents(targetIndex, ...MIDIUtils.setGlobalMIDIParameter(targetTicks, system, param, value));
  }
  if (reverbParams && reverbParams !== "clear") {
    const m = reverbAddressMap;
    const p = reverbParams;
    targetTrack.addEvents(targetIndex, MIDIUtils.gsMessage(targetTicks, 64, 1, m.level, [p.level]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.preLowpass, [p.preLowpass]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.character, [p.character]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.time, [p.time]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.delayFeedback, [p.delayFeedback]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.preDelayTime, [p.preDelayTime]));
  }
  if (chorusParams && chorusParams !== "clear") {
    const m = chorusAddressMap;
    const p = chorusParams;
    targetTrack.addEvents(targetIndex, MIDIUtils.gsMessage(targetTicks, 64, 1, m.level, [p.level]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.preLowpass, [p.preLowpass]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.feedback, [p.feedback]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.delay, [p.delay]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.rate, [p.rate]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.depth, [p.depth]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.sendLevelToReverb, [p.sendLevelToReverb]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.sendLevelToDelay, [p.sendLevelToDelay]));
  }
  if (delayParams && delayParams !== "clear") {
    const m = delayAddressMap;
    const p = delayParams;
    targetTrack.addEvents(targetIndex, MIDIUtils.gsMessage(targetTicks, 64, 1, m.level, [p.level]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.preLowpass, [p.preLowpass]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.timeCenter, [p.timeCenter]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.timeRatioLeft, [p.timeRatioLeft]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.timeRatioRight, [p.timeRatioRight]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.levelCenter, [p.levelCenter]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.levelLeft, [p.levelLeft]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.levelRight, [p.levelRight]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.feedback, [p.feedback]), MIDIUtils.gsMessage(targetTicks, 64, 1, m.sendLevelToReverb, [p.sendLevelToReverb]));
  }
  if (insertionParams && insertionParams !== "clear") {
    const p = insertionParams;
    for (let param = 0; param < p.params.length; param++) {
      const value = p.params[param];
      if (value === 255) continue;
      targetTrack.addEvents(targetIndex, MIDIUtils.gsMessage(targetTicks, 64, 3, param + 3, [value]));
    }
    targetTrack.addEvents(targetIndex, MIDIUtils.gsMessage(targetTicks, 64, 3, 0, [p.type >> 8, p.type & 127]));
  }
  midi.flush();
  SpessaLog.groupEnd();
}
var MIDITrack = class MIDITrack2 {
  /**
  * The name of this track.
  */
  name = "";
  /**
  * The MIDI port number used by the track.
  */
  port = 0;
  /**
  * A set that contains the MIDI channels used by the track in the sequence.
  */
  channels = /* @__PURE__ */ new Set();
  /**
  * All the MIDI messages of this track.
  */
  events = [];
  static copyFrom(track) {
    const t = new MIDITrack2();
    t.copyFrom(track);
    return t;
  }
  copyFrom(track) {
    this.name = track.name;
    this.port = track.port;
    this.channels = new Set(track.channels);
    this.events = track.events.map((e) => new MIDIMessage(e.ticks, e.statusByte, new IndexedByteArray(e.data)));
  }
  /**
  * Adds an event to the track.
  * @param event The event to add.
  * @param index The index at which to add this event.
  * @deprecated Use addEvents instead
  */
  addEvent(event, index) {
    this.events.splice(index, 0, event);
  }
  /**
  * Adds events to the track.
  * @param index The index at which to add these event.
  * @param events The events to add.
  */
  addEvents(index, ...events) {
    this.events.splice(index, 0, ...events);
  }
  /**
  * Removes an event from the track.
  * @param index The index of the event to remove.
  */
  deleteEvent(index) {
    this.events.splice(index, 1);
  }
  /**
  * Appends an event to the end of the track.
  * @param event The event to add.
  */
  pushEvent(event) {
    this.events.push(event);
  }
};
var DataBytesAmount = {
  8: 2,
  9: 2,
  10: 2,
  11: 2,
  12: 1,
  13: 1,
  14: 2
};
function parseSMFInternal(outputMIDI, smfFileBinary, fileName) {
  SpessaLog.groupCollapsed(`%cParsing MIDI File...`, ConsoleColors.info);
  outputMIDI.fileName = fileName;
  const readMIDIChunk = (fileByteArray) => {
    const type = readBinaryStringIndexed(fileByteArray, 4);
    const size = readBigEndianIndexed(fileByteArray, 4);
    const chunk = {
      type,
      size,
      data: new IndexedByteArray(size)
    };
    const dataSlice = fileByteArray.slice(fileByteArray.currentIndex, fileByteArray.currentIndex + chunk.size);
    chunk.data.set(dataSlice, 0);
    fileByteArray.currentIndex += chunk.size;
    return chunk;
  };
  const headerChunk = readMIDIChunk(smfFileBinary);
  if (headerChunk.type !== "MThd") {
    SpessaLog.groupEnd();
    throw new SyntaxError(`Invalid MIDI Header! Expected "MThd", got "${headerChunk.type}"`);
  }
  if (headerChunk.size !== 6) {
    SpessaLog.groupEnd();
    throw new RangeError(`Invalid MIDI header chunk size! Expected 6, got ${headerChunk.size}`);
  }
  outputMIDI.format = readBigEndianIndexed(headerChunk.data, 2);
  const trackCount = readBigEndianIndexed(headerChunk.data, 2);
  outputMIDI.timeDivision = readBigEndianIndexed(headerChunk.data, 2);
  for (let i = 0; i < trackCount; i++) {
    const track = new MIDITrack();
    const trackChunk = readMIDIChunk(smfFileBinary);
    if (trackChunk.type !== "MTrk") {
      SpessaLog.groupEnd();
      throw new SyntaxError(`Invalid track header! Expected "MTrk" got "${trackChunk.type}"`);
    }
    let runningByte;
    let totalTicks = 0;
    if (outputMIDI.format === 2 && i > 0) totalTicks += outputMIDI.tracks[i - 1].events[outputMIDI.tracks[i - 1].events.length - 1].ticks;
    const trackData = trackChunk.data;
    while (trackData.currentIndex < trackChunk.size) {
      totalTicks += readVariableLengthQuantity(trackData);
      const statusByteCheck = trackData[trackData.currentIndex];
      let statusByte;
      if (runningByte !== void 0 && statusByteCheck < 128) statusByte = runningByte;
      else if (statusByteCheck < 128) {
        SpessaLog.groupEnd();
        throw new SyntaxError(`Unexpected byte with no running byte. (${statusByteCheck})`);
      } else {
        statusByte = statusByteCheck;
        trackData.currentIndex++;
      }
      let dataSize;
      if (statusByte >= MIDIMessageTypes.noteOff && statusByte < MIDIMessageTypes.systemExclusive) {
        dataSize = DataBytesAmount[statusByte >> 4];
        runningByte = statusByte;
      } else if (statusByte === MIDIMessageTypes.systemExclusive) dataSize = readVariableLengthQuantity(trackData);
      else if (statusByte === 255) {
        statusByte = trackData[trackData.currentIndex++];
        dataSize = readVariableLengthQuantity(trackData);
      } else dataSize = 0;
      const eventData = new IndexedByteArray(dataSize);
      eventData.set(trackData.slice(trackData.currentIndex, trackData.currentIndex + dataSize));
      track.pushEvent(new MIDIMessage(totalTicks, statusByte, eventData));
      trackData.currentIndex += dataSize;
    }
    outputMIDI.tracks.push(track);
    SpessaLog.info(`%cParsed %c${outputMIDI.tracks.length}%c / %c${outputMIDI.tracks.length}`, ConsoleColors.info, ConsoleColors.value, ConsoleColors.info, ConsoleColors.value);
  }
  SpessaLog.info(`%cAll tracks parsed correctly!`, ConsoleColors.recognized);
  outputMIDI.flush(false);
  SpessaLog.groupEnd();
}
function toISODateString(date) {
  return date.toISOString().split(".")[0] + "Z";
}
var translations = [/* @__PURE__ */ new Map([
  ["domingo", "Sunday"],
  ["segunda-feira", "Monday"],
  ["ter\xE7a-feira", "Tuesday"],
  ["quarta-feira", "Wednesday"],
  ["quinta-feira", "Thursday"],
  ["sexta-feira", "Friday"],
  ["s\xE1bado", "Saturday"],
  ["janeiro", "January"],
  ["fevereiro", "February"],
  ["mar\xE7o", "March"],
  ["abril", "April"],
  ["maio", "May"],
  ["junho", "June"],
  ["julho", "July"],
  ["agosto", "August"],
  ["setembro", "September"],
  ["outubro", "October"],
  ["novembro", "November"],
  ["dezembro", "December"]
])];
function tryTranslate(dateString) {
  for (const translation of translations) {
    let translated = dateString;
    for (const [pt, english] of translation.entries()) {
      const regex = new RegExp(pt, "gi");
      translated = translated.replace(regex, english);
    }
    const date = new Date(translated);
    if (!Number.isNaN(date.getTime())) return date;
  }
}
function tryDotted(dateString) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dateString);
  if (match) {
    const day = Number.parseInt(match[1]);
    const month = Number.parseInt(match[2]) - 1;
    const year = Number.parseInt(match[3]);
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) return date;
  }
}
function tryAWE(dateString) {
  const match = /^(\d{1,2})\s{1,2}(\d{1,2})\s{1,2}(\d{2})$/.exec(dateString);
  if (match) {
    const day = match[1];
    const month = (Number.parseInt(match[2]) + 1).toString();
    const year = match[3];
    const date = /* @__PURE__ */ new Date(`${month}/${day}/${year}`);
    if (!Number.isNaN(date.getTime())) return date;
  }
}
function tryYear(dateString) {
  const match = /\b\d{4}\b/.exec(dateString);
  return match ? new Date(match[0]) : void 0;
}
function parseDateString(dateString) {
  dateString = dateString.trim();
  if (dateString.length === 0) return /* @__PURE__ */ new Date();
  const filtered = dateString.replaceAll(/\b(\d+)(st|nd|rd|th)\b/g, "$1").replace(/\s+at\s+/i, " ");
  const date = new Date(filtered);
  if (Number.isNaN(date.getTime())) {
    const translated = tryTranslate(dateString);
    if (translated) return translated;
    const dotted = tryDotted(dateString);
    if (dotted) return dotted;
    const awe = tryAWE(dateString);
    if (awe) return awe;
    const year = tryYear(dateString);
    if (year) return year;
    SpessaLog.warn(`Invalid date: "${dateString}". Replacing with the current date!`);
    return /* @__PURE__ */ new Date();
  }
  return date;
}
function parseRMIDIInternal(outputMIDI, binaryData, fileName) {
  binaryData.currentIndex += 8;
  const rmid = readBinaryStringIndexed(binaryData, 4);
  if (rmid !== "RMID") {
    SpessaLog.groupEnd();
    throw new SyntaxError(`Invalid RMIDI Header! Expected "RMID", got "${rmid}"`);
  }
  const riff = RIFFChunk.read(binaryData);
  if (riff.header !== "data") {
    SpessaLog.groupEnd();
    throw new SyntaxError(`Invalid RMIDI Chunk header! Expected "data", got "${riff.header}"`);
  }
  const smfFileBinary = riff.data;
  let isSF2RMIDI = false;
  let foundDBNK = false;
  while (binaryData.currentIndex < binaryData.length) {
    const startIndex = binaryData.currentIndex;
    const currentChunk = RIFFChunk.read(binaryData, true);
    if (currentChunk.header === "RIFF") {
      const type = readBinaryStringIndexed(currentChunk.data, 4).toLowerCase();
      if (type === "sfbk" || type === "sfpk" || type === "dls ") {
        SpessaLog.info("%cFound embedded soundbank!", ConsoleColors.recognized);
        outputMIDI.embeddedSoundBank = binaryData.slice(startIndex, startIndex + currentChunk.size).buffer;
      } else SpessaLog.warn(`Unknown RIFF chunk: "${type}"`);
      if (type === "dls ") outputMIDI.isDLSRMIDI = true;
      else isSF2RMIDI = true;
    } else if (currentChunk.header === "LIST") {
      if (readBinaryStringIndexed(currentChunk.data, 4) === "INFO") {
        SpessaLog.info("%cFound RMIDI INFO chunk!", ConsoleColors.recognized);
        while (currentChunk.data.currentIndex < currentChunk.size) {
          const infoChunk = RIFFChunk.read(currentChunk.data, true);
          const headerTyped = infoChunk.header;
          const infoData = infoChunk.data;
          switch (headerTyped) {
            default:
              SpessaLog.warn(`Unknown RMIDI Info: ${headerTyped}`);
              break;
            case "INAM":
              outputMIDI.rmidiInfo.name = infoData;
              break;
            case "IALB":
            case "IPRD":
              outputMIDI.rmidiInfo.album = infoData;
              break;
            case "ICRT":
            case "ICRD":
              outputMIDI.rmidiInfo.creationDate = infoData;
              break;
            case "IART":
              outputMIDI.rmidiInfo.artist = infoData;
              break;
            case "IGNR":
              outputMIDI.rmidiInfo.genre = infoData;
              break;
            case "IPIC":
              outputMIDI.rmidiInfo.picture = infoData;
              break;
            case "ICOP":
              outputMIDI.rmidiInfo.copyright = infoData;
              break;
            case "ICMT":
              outputMIDI.rmidiInfo.comment = infoData;
              break;
            case "IENG":
              outputMIDI.rmidiInfo.engineer = infoData;
              break;
            case "ISFT":
              outputMIDI.rmidiInfo.software = infoData;
              break;
            case "ISBJ":
              outputMIDI.rmidiInfo.subject = infoData;
              break;
            case "IENC":
              outputMIDI.rmidiInfo.infoEncoding = infoData;
              break;
            case "MENC":
              outputMIDI.rmidiInfo.midiEncoding = infoData;
              break;
            case "DBNK":
              outputMIDI.bankOffset = readLittleEndian(infoData, 2);
              foundDBNK = true;
              break;
          }
        }
      }
    }
  }
  if (isSF2RMIDI && !foundDBNK) outputMIDI.bankOffset = 1;
  if (outputMIDI.isDLSRMIDI) outputMIDI.bankOffset = 0;
  if (outputMIDI.embeddedSoundBank === void 0) outputMIDI.bankOffset = 0;
  parseSMFInternal(outputMIDI, smfFileBinary, fileName);
}
var metadataTypes = {
  XMFFileType: 0,
  nodeName: 1,
  nodeIDNumber: 2,
  resourceFormat: 3,
  filenameOnDisk: 4,
  filenameExtensionOnDisk: 5,
  macOSFileTypeAndCreator: 6,
  mimeType: 7,
  title: 8,
  copyrightNotice: 9,
  comment: 10,
  autoStart: 11,
  preload: 12,
  contentDescription: 13,
  ID3Metadata: 14
};
var referenceTypeIds = {
  inLineResource: 1,
  inFileResource: 2,
  inFileNode: 3,
  externalFile: 4,
  externalXMF: 5,
  XMFFileURIandNodeID: 6
};
var resourceFormatIDs = {
  StandardMIDIFile: 0,
  StandardMIDIFileType1: 1,
  DLS1: 2,
  DLS2: 3,
  DLS22: 4,
  mobileDLS: 5,
  unknown: -1,
  folder: -2
};
var formatTypeIDs = {
  standard: 0,
  MMA: 1,
  registered: 2,
  nonRegistered: 3
};
var unpackerIDs = {
  none: 0,
  MMAUnpacker: 1,
  registered: 2,
  nonRegistered: 3
};
var XMFNode = class XMFNode2 {
  length;
  /**
  * 0 means it's a file node
  */
  itemCount;
  metadataLength;
  metadata = {};
  nodeData;
  innerNodes = [];
  packedContent = false;
  nodeUnpackers = [];
  resourceFormat = "unknown";
  referenceTypeID;
  constructor(binaryData) {
    const nodeStartIndex = binaryData.currentIndex;
    this.length = readVariableLengthQuantity(binaryData);
    this.itemCount = readVariableLengthQuantity(binaryData);
    const headerLength = readVariableLengthQuantity(binaryData);
    const remainingHeader = headerLength - (binaryData.currentIndex - nodeStartIndex);
    const headerData = binaryData.slice(binaryData.currentIndex, binaryData.currentIndex + remainingHeader);
    binaryData.currentIndex += remainingHeader;
    this.metadataLength = readVariableLengthQuantity(headerData);
    const metadataChunk = headerData.slice(headerData.currentIndex, headerData.currentIndex + this.metadataLength);
    headerData.currentIndex += this.metadataLength;
    let fieldSpecifier;
    let key;
    while (metadataChunk.currentIndex < metadataChunk.length) {
      if (metadataChunk[metadataChunk.currentIndex] === 0) {
        metadataChunk.currentIndex++;
        fieldSpecifier = readVariableLengthQuantity(metadataChunk);
        if (Object.values(metadataTypes).includes(fieldSpecifier)) key = Object.keys(metadataTypes).find((k) => metadataTypes[k] === fieldSpecifier) ?? "";
        else {
          SpessaLog.info(`Unknown field specifier: ${fieldSpecifier}`);
          key = `unknown_${fieldSpecifier}`;
        }
      } else {
        fieldSpecifier = readBinaryStringIndexed(metadataChunk, readVariableLengthQuantity(metadataChunk));
        key = fieldSpecifier;
      }
      const numberOfVersions = readVariableLengthQuantity(metadataChunk);
      if (numberOfVersions === 0) {
        const dataLength = readVariableLengthQuantity(metadataChunk);
        const contentsChunk = metadataChunk.slice(metadataChunk.currentIndex, metadataChunk.currentIndex + dataLength);
        metadataChunk.currentIndex += dataLength;
        const formatID = readVariableLengthQuantity(contentsChunk);
        this.metadata[key] = formatID < 4 ? readBinaryStringIndexed(contentsChunk, dataLength - 1) : contentsChunk.slice(contentsChunk.currentIndex);
      } else {
        SpessaLog.info(`International content: ${numberOfVersions}`);
        metadataChunk.currentIndex += readVariableLengthQuantity(metadataChunk);
      }
    }
    const unpackersStart = headerData.currentIndex;
    const unpackersLength = readVariableLengthQuantity(headerData);
    const unpackersData = headerData.slice(headerData.currentIndex, unpackersStart + unpackersLength);
    headerData.currentIndex = unpackersStart + unpackersLength;
    if (unpackersLength > 0) {
      this.packedContent = true;
      while (unpackersData.currentIndex < unpackersLength) {
        const unpacker = { id: readVariableLengthQuantity(unpackersData) };
        switch (unpacker.id) {
          case unpackerIDs.nonRegistered:
          case unpackerIDs.registered:
            SpessaLog.groupEnd();
            throw new Error(`Unsupported unpacker ID: ${unpacker.id}`);
          default:
            SpessaLog.groupEnd();
            throw new Error(`Unknown unpacker ID: ${unpacker.id}`);
          case unpackerIDs.none:
            unpacker.standardID = readVariableLengthQuantity(unpackersData);
            break;
          case unpackerIDs.MMAUnpacker:
            {
              let manufacturerID = unpackersData[unpackersData.currentIndex++];
              if (manufacturerID === 0) {
                manufacturerID <<= 8;
                manufacturerID |= unpackersData[unpackersData.currentIndex++];
                manufacturerID <<= 8;
                manufacturerID |= unpackersData[unpackersData.currentIndex++];
              }
              const manufacturerInternalID = readVariableLengthQuantity(unpackersData);
              unpacker.manufacturerID = manufacturerID;
              unpacker.manufacturerInternalID = manufacturerInternalID;
            }
            break;
        }
        unpacker.decodedSize = readVariableLengthQuantity(unpackersData);
        this.nodeUnpackers.push(unpacker);
      }
    }
    binaryData.currentIndex = nodeStartIndex + headerLength;
    this.referenceTypeID = readVariableLengthQuantity(binaryData);
    this.nodeData = binaryData.slice(binaryData.currentIndex, nodeStartIndex + this.length);
    binaryData.currentIndex = nodeStartIndex + this.length;
    switch (this.referenceTypeID) {
      case referenceTypeIds.inLineResource:
        break;
      case referenceTypeIds.externalXMF:
      case referenceTypeIds.inFileNode:
      case referenceTypeIds.XMFFileURIandNodeID:
      case referenceTypeIds.externalFile:
      case referenceTypeIds.inFileResource:
        SpessaLog.groupEnd();
        throw new Error(`Unsupported reference type: ${this.referenceTypeID}`);
      default:
        SpessaLog.groupEnd();
        throw new Error(`Unknown reference type: ${this.referenceTypeID}`);
    }
    if (this.isFile) {
      if (this.packedContent) {
        const compressed = this.nodeData.slice(2);
        SpessaLog.info(`%cPacked content. Attempting to deflate. Target size: %c${this.nodeUnpackers[0].decodedSize}`, ConsoleColors.warn, ConsoleColors.value);
        try {
          this.nodeData = new IndexedByteArray(inf(compressed).buffer);
        } catch (error) {
          SpessaLog.groupEnd();
          if (error instanceof Error) throw new Error(`Error unpacking XMF file contents: ${error.message}.`, { cause: error });
        }
      }
      const resourceFormat = this.metadata.resourceFormat;
      if (resourceFormat === void 0) SpessaLog.warn("No resource format for this file node!");
      else {
        if (resourceFormat[0] !== formatTypeIDs.standard) {
          SpessaLog.info(`Non-standard formatTypeID: ${resourceFormat.toString()}`);
          this.resourceFormat = resourceFormat.toString();
        }
        const resourceFormatID = resourceFormat[1];
        if (Object.values(resourceFormatIDs).includes(resourceFormatID)) this.resourceFormat = Object.keys(resourceFormatIDs).find((k) => resourceFormatIDs[k] === resourceFormatID);
        else SpessaLog.info(`Unrecognized resource format: ${resourceFormatID}`);
      }
    } else {
      this.resourceFormat = "folder";
      while (this.nodeData.currentIndex < this.nodeData.length) {
        const nodeStartIndex2 = this.nodeData.currentIndex;
        const nodeLength = readVariableLengthQuantity(this.nodeData);
        const nodeData = this.nodeData.slice(nodeStartIndex2, nodeStartIndex2 + nodeLength);
        this.nodeData.currentIndex = nodeStartIndex2 + nodeLength;
        this.innerNodes.push(new XMFNode2(nodeData));
      }
    }
  }
  get isFile() {
    return this.itemCount === 0;
  }
};
function loadXMF(midi, binaryData, fileName) {
  midi.bankOffset = 0;
  const sanityCheck = readBinaryStringIndexed(binaryData, 4);
  if (sanityCheck !== "XMF_") {
    SpessaLog.groupEnd();
    throw new SyntaxError(`Invalid XMF Header! Expected "_XMF", got "${sanityCheck}"`);
  }
  SpessaLog.group("%cParsing XMF file...", ConsoleColors.info);
  const version = readBinaryStringIndexed(binaryData, 4);
  SpessaLog.info(`%cXMF version: %c${version}`, ConsoleColors.info, ConsoleColors.recognized);
  if (version === "2.00") {
    const fileTypeId = readBigEndianIndexed(binaryData, 4);
    const fileTypeRevisionId = readBigEndianIndexed(binaryData, 4);
    SpessaLog.info(`%cFile Type ID: %c${fileTypeId}%c, File Type Revision ID: %c${fileTypeRevisionId}`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized);
  }
  readVariableLengthQuantity(binaryData);
  const metadataTableLength = readVariableLengthQuantity(binaryData);
  binaryData.currentIndex += metadataTableLength;
  binaryData.currentIndex = readVariableLengthQuantity(binaryData);
  const rootNode = new XMFNode(binaryData);
  let midiArray = void 0;
  const searchNode = (node) => {
    const checkMeta = (xmf, rmid) => {
      if (node.metadata[xmf] !== void 0 && typeof node.metadata[xmf] === "string") midi.rmidiInfo[rmid] = getStringBytes(node.metadata[xmf]);
    };
    checkMeta("nodeName", "name");
    checkMeta("title", "name");
    checkMeta("copyrightNotice", "copyright");
    checkMeta("comment", "comment");
    if (node.isFile) switch (node.resourceFormat) {
      default:
        return;
      case "DLS1":
      case "DLS2":
      case "DLS22":
      case "mobileDLS":
        SpessaLog.info("%cFound embedded DLS!", ConsoleColors.recognized);
        midi.embeddedSoundBank = node.nodeData.buffer;
        break;
      case "StandardMIDIFile":
      case "StandardMIDIFileType1":
        SpessaLog.info("%cFound embedded MIDI!", ConsoleColors.recognized);
        midiArray = node.nodeData;
        break;
    }
    else for (const n of node.innerNodes) searchNode(n);
  };
  searchNode(rootNode);
  SpessaLog.groupEnd();
  if (!midiArray) throw new Error("No MIDI data in the XMF file!");
  parseSMFInternal(midi, midiArray, fileName);
}
function applySnapshotInternal(midi, snapshot) {
  const channels = /* @__PURE__ */ new Map();
  const globalKeyShift = snapshot.systemParameters.keyShift;
  const globalFineTune = snapshot.systemParameters.fineTune;
  for (let channelNumber = 0; channelNumber < snapshot.midiChannels.length; channelNumber++) {
    const channelSnapshot = snapshot.midiChannels[channelNumber];
    if (channelSnapshot.systemParameters.isMuted) {
      channels.set(channelNumber, "clear");
      continue;
    }
    const keyShift = channelSnapshot.systemParameters.keyShift + (channelSnapshot.drumChannel ? 0 : globalKeyShift);
    const fineTune = channelSnapshot.systemParameters.fineTune + (channelSnapshot.drumChannel ? 0 : globalFineTune);
    let patch;
    if (channelSnapshot.systemParameters.presetLock && channelSnapshot.patch) patch = { ...channelSnapshot.patch };
    const controllers = /* @__PURE__ */ new Map();
    for (let ccNumber = 0; ccNumber < 128; ccNumber++) {
      if (!channelSnapshot.lockedControllers[ccNumber] || ccNumber === MIDIControllers.bankSelect) continue;
      const targetValue = channelSnapshot.midiControllers[ccNumber] >> 7;
      controllers.set(ccNumber, targetValue);
    }
    const midiParams2 = {};
    for (const [parameter, value] of Object.entries(channelSnapshot.midiParameters)) if (channelSnapshot.lockedMIDIParameters[parameter]) midiParams2[parameter] = value;
    channels.set(channelNumber, {
      keyShift,
      fineTune,
      patch,
      controllers,
      midiParams: midiParams2
    });
  }
  const midiParams = {};
  for (const [parameter, value] of Object.entries(snapshot.midiParameters)) if (snapshot.lockedMIDIParameters[parameter]) midiParams[parameter] = value;
  midi.modify({
    channels,
    drumSetupParams: snapshot.systemParameters.drumLock ? "clear" : void 0,
    reverbParams: snapshot.systemParameters.reverbLock ? snapshot.reverbProcessor : void 0,
    chorusParams: snapshot.systemParameters.chorusLock ? snapshot.chorusProcessor : void 0,
    delayParams: snapshot.systemParameters.delayLock ? snapshot.delayProcessor : void 0,
    insertionParams: snapshot.systemParameters.insertionEffectLock ? snapshot.insertionProcessor : void 0,
    midiParams
  });
}
var BasicMIDI = class BasicMIDI2 {
  /**
  * The tracks in the sequence.
  */
  tracks = [];
  /**
  * A flattened, time‑sorted list of all events in the MIDI sequence.
  * The order between the tracks is preserved.
  * Each entry points to the event's track number and its index within that track.
  * This is the recommended way of iterating over the MIDI sequence's events.
  *
  * Do not change this array.
  */
  timeline = [];
  /**
  * The time division of the sequence, representing the number of MIDI ticks per beat.
  */
  timeDivision = 480;
  /**
  * The duration of the sequence, in seconds.
  */
  duration = 0;
  /**
  * The tempo changes in the sequence, ordered from the last change to the first.
  * Each change is represented by an object with a MIDI tick position and a tempo value in beats per minute.
  */
  tempoChanges = [{
    ticks: 0,
    tempo: 120
  }];
  /**
  * Any extra metadata found in the file.
  * These messages were deemed "interesting" by the parsing algorithm
  */
  extraMetadata = [];
  /**
  * An array containing the lyrics of the sequence.
  */
  lyrics = [];
  /**
  * The tick position of the first note-on event in the MIDI sequence.
  */
  firstNoteOn = 0;
  /**
  * The MIDI key range used in the sequence, represented by a minimum and maximum note value.
  */
  keyRange = {
    min: 0,
    max: 127
  };
  /**
  * The tick position of the last voice event (such as note-on, note-off, or control change) in the sequence.
  */
  lastVoiceEventTick = 0;
  /**
  * An array of channel offsets for each MIDI port, using the SpessaSynth method.
  * The index is the port number and the value is the channel offset.
  */
  portChannelOffsetMap = [0];
  /**
  * The loop points (in ticks) of the sequence, including both start and end points.
  */
  loop = {
    start: 0,
    end: 0,
    type: "hard"
  };
  /**
  * The file name of the MIDI sequence, if provided during parsing.
  */
  fileName;
  /**
  * The format of the MIDI file, which can be 0, 1, or 2, indicating the type of the MIDI file.
  */
  format = 0;
  /**
  * The RMID (Resource-Interchangeable MIDI) info data, if the file is RMID formatted.
  * Otherwise, this object is empty.
  * Info type: Chunk data as a binary array.
  * Note that text chunks contain a terminal zero byte.
  */
  rmidiInfo = {};
  /**
  * The bank offset used for RMID files.
  */
  bankOffset = 0;
  /**
  * If the MIDI file is a Soft Karaoke file (.kar), this is set to true.
  * https://www.mixagesoftware.com/en/midikit/help/HTML/karaoke_formats.html
  */
  isKaraokeFile = false;
  /**
  * Indicates if this file is a Multi-Port MIDI file.
  */
  isMultiPort = false;
  /**
  * If the MIDI file is a DLS RMIDI file.
  */
  isDLSRMIDI = false;
  /**
  * The embedded sound bank in the MIDI file, represented as an ArrayBuffer, if available.
  */
  embeddedSoundBank;
  /**
  * The raw, encoded MIDI name, represented as a Uint8Array.
  * Useful when the MIDI file uses a different code page.
  * Undefined if no MIDI name could be found.
  */
  binaryName;
  /**
  * The encoding of the RMIDI info in file, if specified.
  */
  get infoEncoding() {
    const encodingInfo = this.rmidiInfo.infoEncoding;
    if (!encodingInfo) return;
    let lengthToRead = encodingInfo.byteLength;
    if (encodingInfo[encodingInfo.byteLength - 1] === 0) lengthToRead--;
    return readBinaryString(encodingInfo, lengthToRead);
  }
  /**
  * Loads a MIDI file (SMF, RMIDI, XMF) from a given ArrayBuffer.
  * @param arrayBuffer The ArrayBuffer containing the binary file data.
  * @param fileName The optional name of the file, will be used if the MIDI file does not have a name.
  * @remarks
  * This function reads the MIDI file format, extracts the header and track chunks,
  * and populates the BasicMIDI instance with the parsed data.
  * It supports Standard MIDI Files (SMF), RIFF MIDI (RMIDI), and Extensible Music Format (XMF).
  * It also handles embedded soundbanks in RMIDI files.
  * If the file is an RMIDI file, it will extract the embedded soundbank and store
  * it in the `embeddedSoundBank` property of the BasicMIDI instance.
  * If the file is an XMF file, it will parse the XMF structure and extract the MIDI data.
  */
  static fromArrayBuffer(arrayBuffer, fileName = "") {
    const mid = new BasicMIDI2();
    const binaryData = new IndexedByteArray(arrayBuffer);
    switch (readBinaryString(binaryData, 4)) {
      case "RIFF":
        parseRMIDIInternal(mid, binaryData, fileName);
        break;
      case "XMF_":
        loadXMF(mid, binaryData, fileName);
        break;
      default:
        parseSMFInternal(mid, binaryData, fileName);
        break;
    }
    return mid;
  }
  /**
  * Loads a MIDI file (SMF, RMIDI, XMF) from a given file.
  * @param file The file to load.
  */
  static async fromFile(file) {
    return this.fromArrayBuffer(await file.arrayBuffer(), file.name);
  }
  /**
  * Copies a MIDI.
  * @param mid The MIDI to copy.
  * @returns The copied MIDI.
  */
  static copyFrom(mid) {
    const m = new BasicMIDI2();
    m.copyFrom(mid);
    return m;
  }
  /**
  * Copies a MIDI.
  * @param mid The MIDI to copy.
  */
  copyFrom(mid) {
    this.copyMetadataFrom(mid);
    this.embeddedSoundBank = mid?.embeddedSoundBank?.slice(0) ?? void 0;
    this.tracks = mid.tracks.map((track) => MIDITrack.copyFrom(track));
    this.timeline = mid.timeline.map((t) => ({ ...t }));
  }
  /**
  * Converts MIDI ticks to time in seconds.
  * @param ticks The time in MIDI ticks.
  * @returns The time in seconds.
  */
  midiTicksToSeconds(ticks) {
    ticks = Math.max(ticks, 0);
    if (this.tempoChanges.length === 0) throw new Error("There are no tempo changes in the sequence. At least one is needed.");
    if (this.tempoChanges[this.tempoChanges.length - 1].ticks !== 0) throw new Error(`The last tempo change is not at 0 ticks. Got ${this.tempoChanges[this.tempoChanges.length - 1].ticks} ticks.`);
    let tempoIndex = this.tempoChanges.findIndex((v) => v.ticks <= ticks);
    let totalSeconds = 0;
    while (tempoIndex < this.tempoChanges.length) {
      const tempo = this.tempoChanges[tempoIndex++];
      const ticksSinceLastTempo = ticks - tempo.ticks;
      totalSeconds += ticksSinceLastTempo * 60 / (tempo.tempo * this.timeDivision);
      ticks = tempo.ticks;
    }
    return totalSeconds;
  }
  /**
  * Converts seconds to time in MIDI ticks.
  * @param seconds The time in seconds.
  * @returns The time in MIDI ticks.
  */
  secondsToMIDITicks(seconds) {
    seconds = Math.max(seconds, 0);
    if (seconds === 0) return 0;
    if (this.tempoChanges.length === 0) throw new Error("There are no tempo changes in the sequence. At least one is needed.");
    if (this.tempoChanges[this.tempoChanges.length - 1].ticks !== 0) throw new Error(`The last tempo change is not at 0 ticks. Got ${this.tempoChanges[this.tempoChanges.length - 1].ticks} ticks.`);
    let remainingSeconds = seconds;
    let totalTicks = 0;
    for (let i = this.tempoChanges.length - 1; i >= 0; i--) {
      const currentTempo = this.tempoChanges[i];
      const next = this.tempoChanges[i - 1];
      const ticksToNextTempo = next ? next.ticks - currentTempo.ticks : Infinity;
      const oneTickToSeconds = 60 / (currentTempo.tempo * this.timeDivision);
      const secondsToNextTempo = ticksToNextTempo * oneTickToSeconds;
      if (remainingSeconds <= secondsToNextTempo) {
        totalTicks += Math.round(remainingSeconds / oneTickToSeconds);
        return totalTicks;
      }
      totalTicks += ticksToNextTempo;
      remainingSeconds -= secondsToNextTempo;
    }
    return totalTicks;
  }
  /**
  * Gets the used programs and keys for this MIDI file with a given sound bank.
  * @param soundbank the sound bank.
  * @returns The output data is a key-value pair: preset -> Map<midiNote, Set<velocity>>
  */
  getUsedProgramsAndKeys(soundbank) {
    return getUsedProgramsAndKeys(this, soundbank);
  }
  /**
  * Preloads all voices for this sequence in a given synth.
  * This caches all the needed voices for playing back this sequencer, resulting in a smooth playback.
  * The sequencer calls this function by default when loading the songs.
  * @param synth
  */
  preloadSynth(synth) {
    SpessaLog.groupCollapsed(`%cPreloading samples...`, ConsoleColors.info);
    const used = this.getUsedProgramsAndKeys(synth.soundBankManager);
    for (const [preset, keys] of used.entries()) {
      SpessaLog.info(`%cPreloading used samples on %c${preset.name}%c...`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info);
      for (const [midiNote, velocities] of keys.entries()) for (const velocity of velocities) synth.getVoicesForPreset(preset, midiNote, velocity);
    }
    SpessaLog.groupEnd();
  }
  /**
  * Updates all internal values of the MIDI.
  * @param sortEvents if the events should be sorted by ticks. Recommended to be true.
  */
  flush(sortEvents = true) {
    if (sortEvents) for (const t of this.tracks) t.events.sort((e1, e2) => e1.ticks - e2.ticks);
    this.parseInternal();
  }
  /**
  * Calculates all note times in seconds.
  * @param minDrumLength the shortest a drum note (channel 10) can be, in seconds.
  * @returns an array of 16 channels, each channel containing its notes,
  * with their key number, velocity, absolute start time and length in seconds.
  */
  getNoteTimes(minDrumLength = 0) {
    return getNoteTimesInternal(this, minDrumLength);
  }
  /**
  * Exports the midi as a standard MIDI file.
  * @returns the binary file data.
  */
  writeMIDI() {
    return writeMIDIInternal(this);
  }
  /**
  * Writes an RMIDI file. Note that this method modifies the MIDI file in-place.
  * @param soundBankBinary the binary sound bank to embed into the file.
  * @param configuration Extra options for writing the file.
  * @returns the binary file data.
  */
  writeRMIDI(soundBankBinary, configuration = DEFAULT_RMIDI_WRITE_OPTIONS) {
    return writeRMIDIInternal(this, soundBankBinary, fillWithDefaults(configuration, DEFAULT_RMIDI_WRITE_OPTIONS));
  }
  /**
  * Allows easily modifying the sequence's programs and controllers.
  * This is a very sophisticated method that supports various MIDI systems
  * and inserts/deletes messages appropriately.
  *
  * This modifies the MIDI sequence _in-place_.
  */
  modify(opts) {
    modifyMIDIInternal(this, opts);
  }
  /**
  * Modifies the sequence *in-place* according to the locked presets and controllers in the given snapshot.
  *
  * Note that System Parameters `fineTune` and `keyShift` are passed to the relative tuning parameters of the channels.
  * Only locked MIDI parameters and controllers are applied.
  * @param snapshot the snapshot to apply.
  */
  applySnapshot(snapshot) {
    applySnapshotInternal(this, snapshot);
  }
  /**
  * Gets the MIDI's decoded name.
  * @param encoding The encoding to use if the MIDI uses an extended code page.
  * @remarks
  * Do not call in audioWorkletGlobalScope as it uses TextDecoder.
  * RMIDI encoding overrides the provided encoding.
  */
  getName(encoding = "Shift_JIS") {
    let rawName = "";
    const n = this.getRMIDInfo("name");
    if (n) return n.trim();
    if (this.binaryName) {
      encoding = this.getRMIDInfo("midiEncoding") ?? encoding;
      try {
        rawName = new TextDecoder(encoding).decode(this.binaryName).trim();
      } catch (error) {
        SpessaLog.warn(`Failed to decode MIDI name: ${error}`);
      }
    }
    return rawName || this.fileName;
  }
  /**
  * Gets the decoded extra metadata as text and removes any unneeded characters (such as "@T" for karaoke files)
  * @param encoding The encoding to use if the MIDI uses an extended code page.
  * @remarks
  * Do not call in audioWorkletGlobalScope as it uses TextDecoder.
  * RMIDI encoding overrides the provided encoding.
  */
  getExtraMetadata(encoding = "Shift_JIS") {
    encoding = this.infoEncoding ?? encoding;
    const decoder = new TextDecoder(encoding);
    return this.extraMetadata.map((d) => {
      return decoder.decode(d.data).replaceAll(/@T|@A/g, "").trim();
    });
  }
  /**
  * Sets a given RMIDI info value.
  * @param infoType The type to set.
  * @param infoData The value to set it to.
  * @remarks
  * This sets the Info encoding to utf-8.
  */
  setRMIDInfo(infoType, infoData) {
    this.rmidiInfo.infoEncoding = getStringBytes("utf-8", true);
    if (infoType === "picture") this.rmidiInfo.picture = new Uint8Array(infoData);
    else if (infoType === "creationDate") this.rmidiInfo.creationDate = getStringBytes(toISODateString(infoData), true);
    else {
      const encoded = new TextEncoder().encode(infoData);
      this.rmidiInfo[infoType] = new Uint8Array([...encoded, 0]);
    }
  }
  /**
  * Gets a given chunk from the RMIDI information, undefined if it does not exist.
  * @param infoType The metadata type.
  * @returns String, Date, ArrayBuffer or undefined.
  */
  getRMIDInfo(infoType) {
    if (!this.rmidiInfo[infoType]) return;
    const encoding = this.infoEncoding ?? "UTF-8";
    if (infoType === "picture") return this.rmidiInfo[infoType].buffer;
    else if (infoType === "creationDate") return parseDateString(readBinaryString(this.rmidiInfo[infoType]));
    try {
      const decoder = new TextDecoder(encoding);
      let infoBuffer = this.rmidiInfo[infoType];
      if (infoBuffer[infoBuffer.length - 1] === 0) infoBuffer = infoBuffer?.slice(0, -1);
      return decoder.decode(infoBuffer.buffer).trim();
    } catch (error) {
      SpessaLog.warn(`Failed to decode ${infoType} name: ${error}`);
      return;
    }
  }
  /**
  * Iterates over the MIDI file, ordered by the time the events happen.
  * You probably should use the `timeline` property
  * if you're not mutating the MIDI in the iteration loop.
  * @param callback The callback function to process each event.
  */
  iterate(callback) {
    const eventIndexes = new Array(this.tracks.length).fill(0);
    let remainingTracks = this.tracks.length;
    while (remainingTracks > 0) {
      let trackNum = 0;
      let ticks = Infinity;
      for (let i = 0; i < this.tracks.length; i++) {
        const track2 = this.tracks[i].events;
        if (eventIndexes[i] >= track2.length) continue;
        if (track2[eventIndexes[i]].ticks < ticks) {
          trackNum = i;
          ticks = track2[eventIndexes[i]].ticks;
        }
      }
      const track = this.tracks[trackNum].events;
      if (eventIndexes[trackNum] >= track.length) {
        remainingTracks--;
        continue;
      }
      const idx = eventIndexes[trackNum];
      callback(track[idx], trackNum, eventIndexes);
      eventIndexes[trackNum]++;
    }
  }
  /**
  * INTERNAL USE ONLY!
  */
  copyMetadataFrom(mid) {
    this.fileName = mid.fileName;
    this.timeDivision = mid.timeDivision;
    this.duration = mid.duration;
    this.firstNoteOn = mid.firstNoteOn;
    this.lastVoiceEventTick = mid.lastVoiceEventTick;
    this.format = mid.format;
    this.bankOffset = mid.bankOffset;
    this.isKaraokeFile = mid.isKaraokeFile;
    this.isMultiPort = mid.isMultiPort;
    this.isDLSRMIDI = mid.isDLSRMIDI;
    this.isDLSRMIDI = mid.isDLSRMIDI;
    this.tempoChanges = [...mid.tempoChanges];
    this.extraMetadata = mid.extraMetadata.map((m) => new MIDIMessage(m.ticks, m.statusByte, new IndexedByteArray(m.data)));
    this.lyrics = mid.lyrics.map((arr) => new MIDIMessage(arr.ticks, arr.statusByte, new IndexedByteArray(arr.data)));
    this.portChannelOffsetMap = [...mid.portChannelOffsetMap];
    this.binaryName = mid?.binaryName?.slice();
    this.loop = { ...mid.loop };
    this.keyRange = { ...mid.keyRange };
    this.rmidiInfo = {};
    for (const v of Object.entries(mid.rmidiInfo)) {
      const key = v[0];
      const value = v[1];
      this.rmidiInfo[key] = new Uint8Array(value);
    }
  }
  /**
  * Parses internal MIDI values
  */
  parseInternal() {
    SpessaLog.group("%cInterpreting MIDI events...", ConsoleColors.info);
    let karaokeHasTitle = false;
    this.tempoChanges = [{
      ticks: 0,
      tempo: 120
    }];
    this.extraMetadata = [];
    this.lyrics = [];
    this.firstNoteOn = 0;
    this.keyRange = {
      max: 0,
      min: 127
    };
    this.lastVoiceEventTick = 0;
    this.portChannelOffsetMap = [0];
    this.loop = {
      start: 0,
      end: 0,
      type: "hard"
    };
    this.isKaraokeFile = false;
    this.isMultiPort = false;
    let nameDetected = false;
    if (this.rmidiInfo.name !== void 0) nameDetected = true;
    let loopStart = null;
    let loopEnd = null;
    let loopType = "hard";
    for (const track of this.tracks) {
      const usedChannels = /* @__PURE__ */ new Set();
      let trackHasVoiceMessages = false;
      for (let i = 0; i < track.events.length; i++) {
        const e = track.events[i];
        if (e.statusByte >= 128 && e.statusByte < 240) {
          trackHasVoiceMessages = true;
          if (e.ticks > this.lastVoiceEventTick) this.lastVoiceEventTick = e.ticks;
          switch (e.statusByte & 240) {
            case MIDIMessageTypes.controllerChange:
              switch (e.data[0]) {
                case MIDIControllers.breathController:
                case MIDIControllers.undefinedCC111LSB:
                  if (e.data[1] === 0) loopStart = e.ticks;
                  break;
                case MIDIControllers.undefinedCC116LSB:
                  loopStart = e.ticks;
                  break;
                case MIDIControllers.footController:
                case MIDIControllers.undefinedCC117LSB:
                  if (loopEnd === null && (e.data[0] !== 4 || e.data[0] === 4 && e.data[1] === 0)) {
                    loopType = "soft";
                    loopEnd = e.ticks;
                  } else {
                    loopEnd = 0;
                    loopType = "hard";
                  }
                  break;
                case MIDIControllers.bankSelect:
                  if (this.isDLSRMIDI && e.data[1] !== 0 && e.data[1] !== 127) {
                    SpessaLog.info("%cDLS RMIDI with offset 1 detected!", ConsoleColors.recognized);
                    this.bankOffset = 1;
                  }
              }
              break;
            case MIDIMessageTypes.noteOn: {
              usedChannels.add(e.statusByte & 15);
              const note = e.data[0];
              this.keyRange.min = Math.min(this.keyRange.min, note);
              this.keyRange.max = Math.max(this.keyRange.max, note);
              break;
            }
          }
        }
        const eventText = readBinaryString(e.data);
        switch (e.statusByte) {
          case MIDIMessageTypes.endOfTrack:
            if (i !== track.events.length - 1) {
              track.deleteEvent(i);
              i--;
              SpessaLog.warn("Unexpected EndOfTrack. Removing!");
            }
            break;
          case MIDIMessageTypes.setTempo:
            this.tempoChanges.push({
              ticks: e.ticks,
              tempo: 6e7 / readBigEndian(e.data, 3)
            });
            break;
          case MIDIMessageTypes.marker:
            switch (eventText.trim().toLowerCase()) {
              default:
                break;
              case "start":
              case "loopstart":
                loopStart = e.ticks;
                break;
              case "loopend":
                loopEnd = e.ticks;
            }
            break;
          case MIDIMessageTypes.copyright:
            this.extraMetadata.push(e);
            break;
          case MIDIMessageTypes.lyric:
            if (eventText.trim().startsWith("@KMIDI KARAOKE FILE")) {
              this.isKaraokeFile = true;
              SpessaLog.info("%cKaraoke MIDI detected!", ConsoleColors.recognized);
            }
            if (this.isKaraokeFile) e.statusByte = MIDIMessageTypes.text;
            else this.lyrics.push(e);
          case MIDIMessageTypes.text: {
            const checkedText = eventText.trim();
            if (checkedText.startsWith("@KMIDI KARAOKE FILE")) {
              this.isKaraokeFile = true;
              SpessaLog.info("%cKaraoke MIDI detected!", ConsoleColors.recognized);
            } else if (this.isKaraokeFile) {
              if (checkedText.startsWith("@T") || checkedText.startsWith("@A")) if (karaokeHasTitle) this.extraMetadata.push(e);
              else {
                this.binaryName = e.data.slice(2);
                karaokeHasTitle = true;
                nameDetected = true;
              }
              else if (!checkedText.startsWith("@")) this.lyrics.push(e);
            }
            break;
          }
        }
      }
      track.channels = usedChannels;
      track.name = "";
      const trackName = track.events.find((e) => e.statusByte === MIDIMessageTypes.trackName);
      if (trackName && this.tracks.indexOf(track) > 0) {
        track.name = readBinaryString(trackName.data);
        if (!trackHasVoiceMessages && !track.name.toLowerCase().includes("setup")) this.extraMetadata.push(trackName);
      }
    }
    this.tempoChanges.reverse();
    SpessaLog.info(`%cCorrecting loops, ports and detecting notes...`, ConsoleColors.info);
    const firstNoteOns = [];
    for (const t of this.tracks) {
      const firstNoteOn = t.events.find((e) => (e.statusByte & 240) === MIDIMessageTypes.noteOn);
      if (firstNoteOn) firstNoteOns.push(firstNoteOn.ticks);
    }
    this.firstNoteOn = Math.min(...firstNoteOns);
    SpessaLog.info(`%cFirst note-on detected at: %c${this.firstNoteOn}%c ticks!`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info);
    loopStart ??= this.firstNoteOn;
    if (loopEnd === null || loopEnd === 0) loopEnd = this.lastVoiceEventTick;
    this.loop = {
      start: loopStart,
      end: loopEnd,
      type: loopType
    };
    this.lastVoiceEventTick = Math.max(this.lastVoiceEventTick, this.loop.end);
    SpessaLog.info(`%cLoop points: start: %c${this.loop.start}%c end: %c${this.loop.end}`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized);
    let portOffset = 0;
    this.portChannelOffsetMap = [];
    for (const track of this.tracks) {
      track.port = -1;
      if (track.channels.size === 0) continue;
      for (const e of track.events) {
        if (e.statusByte !== MIDIMessageTypes.midiPort) continue;
        const port = e.data[0];
        track.port = port;
        if (this.portChannelOffsetMap[port] === void 0) {
          this.portChannelOffsetMap[port] = portOffset;
          portOffset += 16;
        }
      }
    }
    this.portChannelOffsetMap = [...this.portChannelOffsetMap].map((o) => o ?? 0);
    let defaultPort = Infinity;
    for (const track of this.tracks) if (track.port !== -1 && defaultPort > track.port) defaultPort = track.port;
    if (defaultPort === Infinity) defaultPort = 0;
    for (const track of this.tracks) if (track.port === -1 || track.port === void 0) track.port = defaultPort;
    if (this.portChannelOffsetMap.length === 0) this.portChannelOffsetMap = [0];
    if (this.portChannelOffsetMap.length < 2) SpessaLog.info(`%cNo additional MIDI Ports detected.`, ConsoleColors.info);
    else {
      this.isMultiPort = true;
      SpessaLog.info(`%cMIDI Ports detected!`, ConsoleColors.recognized);
    }
    if (!nameDetected) if (this.tracks.length > 1) {
      if (!this.tracks[0].events.some((message) => message.statusByte >= MIDIMessageTypes.noteOn && message.statusByte < MIDIMessageTypes.polyPressure)) {
        const name = this.tracks[0].events.find((message) => message.statusByte === MIDIMessageTypes.trackName);
        if (name) this.binaryName = name.data;
      }
    } else {
      const name = this.tracks[0].events.find((message) => message.statusByte === MIDIMessageTypes.trackName);
      if (name) this.binaryName = name.data;
    }
    this.extraMetadata = this.extraMetadata.filter((c) => c.data.length > 0);
    this.lyrics.sort((a, b) => a.ticks - b.ticks);
    if (!this.tracks.some((t) => t.events[0].ticks === 0)) {
      const track = this.tracks[0];
      let b = this?.binaryName?.buffer;
      if (!b) b = new Uint8Array(0).buffer;
      track.addEvents(0, new MIDIMessage(0, MIDIMessageTypes.trackName, new IndexedByteArray(b)));
    }
    this.duration = this.midiTicksToSeconds(this.lastVoiceEventTick);
    this.timeline.length = 0;
    this.iterate((_, tr2, eventIndexes) => {
      this.timeline.push(Object.freeze({
        ev: eventIndexes[tr2],
        tr: tr2
      }));
    });
    if (this.binaryName?.length === 0) this.binaryName = void 0;
    SpessaLog.info(`%cMIDI file parsed. Total tick time: %c${this.lastVoiceEventTick}%c, total seconds time: %c${formatTime(Math.ceil(this.duration)).time}`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized);
    SpessaLog.groupEnd();
  }
};
function processEventInternal(event, trackIndex) {
  if (this.externalMIDIPlayback && event.statusByte >= 128) {
    this.sendMIDIMessage([event.statusByte, ...event.data]);
    return;
  }
  const track = this._midiData.tracks[trackIndex];
  let status;
  let channel = 0;
  if (event.statusByte >= 128 && event.statusByte < 240) {
    status = event.statusByte & 240;
    channel = event.statusByte & 15;
  } else status = event.statusByte;
  const offset = this.midiPortChannelOffsets[this.currentMIDIPorts[trackIndex]] || 0;
  channel += offset;
  switch (status) {
    case MIDIMessageTypes.noteOn: {
      let playingNotes = this.playingNotes[channel];
      if (!playingNotes) {
        while (this.playingNotes.length <= channel) this.playingNotes.push(/* @__PURE__ */ new Map());
        playingNotes = this.playingNotes[channel];
      }
      const velocity = event.data[1];
      if (velocity > 0) {
        this.synth.noteOn(channel, event.data[0], velocity);
        playingNotes.set(event.data[0], velocity);
      } else {
        this.synth.noteOff(channel, event.data[0]);
        playingNotes.delete(event.data[0]);
      }
      break;
    }
    case MIDIMessageTypes.noteOff: {
      let playingNotes = this.playingNotes[channel];
      if (!playingNotes) {
        while (this.playingNotes.length <= channel) this.playingNotes.push(/* @__PURE__ */ new Map());
        playingNotes = this.playingNotes[channel];
      }
      this.synth.noteOff(channel, event.data[0]);
      playingNotes.delete(event.data[0]);
      break;
    }
    case MIDIMessageTypes.pitchWheel:
      this.synth.pitchWheel(channel, event.data[1] << 7 | event.data[0]);
      break;
    case MIDIMessageTypes.controllerChange:
      if (this._midiData.isMultiPort && track.channels.size === 0) return;
      this.synth.controllerChange(channel, event.data[0], event.data[1]);
      break;
    case MIDIMessageTypes.programChange:
      if (this._midiData.isMultiPort && track.channels.size === 0) return;
      this.synth.programChange(channel, event.data[0]);
      break;
    case MIDIMessageTypes.polyPressure:
      this.synth.polyPressure(channel, event.data[0], event.data[1]);
      break;
    case MIDIMessageTypes.channelPressure:
      this.synth.channelPressure(channel, event.data[0]);
      break;
    case MIDIMessageTypes.systemExclusive:
      this.synth.systemExclusive(event.data, offset);
      break;
    case MIDIMessageTypes.setTempo: {
      const tempoBPM = 6e7 / readBigEndian(event.data, 3);
      this.oneTickToSeconds = 60 / (tempoBPM * this._midiData.timeDivision);
      if (this.oneTickToSeconds === 0) {
        this.oneTickToSeconds = 60 / (120 * this._midiData.timeDivision);
        SpessaLog.info("invalid tempo! falling back to 120 BPM");
      }
      break;
    }
    case MIDIMessageTypes.timeSignature:
    case MIDIMessageTypes.endOfTrack:
    case MIDIMessageTypes.midiChannelPrefix:
    case MIDIMessageTypes.songPosition:
    case MIDIMessageTypes.activeSensing:
    case MIDIMessageTypes.keySignature:
    case MIDIMessageTypes.sequenceNumber:
    case MIDIMessageTypes.sequenceSpecific:
    case MIDIMessageTypes.text:
    case MIDIMessageTypes.lyric:
    case MIDIMessageTypes.copyright:
    case MIDIMessageTypes.trackName:
    case MIDIMessageTypes.marker:
    case MIDIMessageTypes.cuePoint:
    case MIDIMessageTypes.instrumentName:
    case MIDIMessageTypes.programName:
      break;
    case MIDIMessageTypes.midiPort:
      this.assignMIDIPort(trackIndex, event.data[0]);
      break;
    case MIDIMessageTypes.reset:
      this.synth.stopAllChannels();
      this.synth.reset();
      break;
    default:
      SpessaLog.info(`%cUnrecognized Event: %c${event.statusByte}%c status byte: %c${Object.keys(MIDIMessageTypes).find((k) => MIDIMessageTypes[k] === status)}`, ConsoleColors.warn, ConsoleColors.unrecognized, ConsoleColors.warn, ConsoleColors.value);
      break;
  }
  if (status >= 0 && status < 128) this.callEvent("metaEvent", {
    event,
    trackIndex
  });
}
function processTick() {
  if (this.paused || !this._midiData) return;
  const currentTime = this.currentTime;
  while (this.playedTime < currentTime) {
    const { timeline, tracks, lastVoiceEventTick, loop } = this._midiData;
    const e = timeline[this.index++];
    const event = tracks[e.tr].events[e.ev];
    this.processEvent(event, e.tr);
    if (this.loopCount > 0 && loop.end <= event.ticks) {
      if (this.loopCount !== Infinity) {
        this.loopCount--;
        this.callEvent("loopCountChange", { newCount: this.loopCount });
      }
      if (loop.type === "soft") this.jumpToTick(loop.start);
      else this.setTimeTicks(loop.start);
      return;
    }
    if (this.index >= timeline.length || event.ticks >= lastVoiceEventTick) {
      this.songIsFinished();
      return;
    }
    const nE = timeline[this.index];
    const nextEvent = tracks[nE.tr].events[nE.ev];
    this.playedTime += this.oneTickToSeconds * (nextEvent.ticks - event.ticks);
  }
}
function assignMIDIPortInternal(trackNum, port) {
  if (this._midiData.tracks[trackNum].channels.size === 0) return;
  if (this.midiPortChannelOffset === 0) {
    this.midiPortChannelOffset += 16;
    this.midiPortChannelOffsets[port] = 0;
  }
  if (this.midiPortChannelOffsets[port] === void 0) {
    if (this.synth.midiChannels.length < this.midiPortChannelOffset + 15) this.addNewMIDIPort();
    this.midiPortChannelOffsets[port] = this.midiPortChannelOffset;
    this.midiPortChannelOffset += 16;
  }
  this.currentMIDIPorts[trackNum] = port;
}
function loadNewSequenceInternal(parsedMIDI) {
  if (!parsedMIDI.tracks) throw new Error("This MIDI has no tracks!");
  if (parsedMIDI.duration === 0) {
    SpessaLog.warn("This MIDI file has a duration of exactly 0 seconds.");
    this.pausedTime = 0;
    this.isFinished = true;
    return;
  }
  this.oneTickToSeconds = 60 / (120 * parsedMIDI.timeDivision);
  this._midiData = parsedMIDI;
  this.isFinished = false;
  this.synth.clearEmbeddedSoundBank();
  if (this._midiData.embeddedSoundBank !== void 0) {
    SpessaLog.info("%cEmbedded soundbank detected! Using it.", ConsoleColors.recognized);
    this.synth.setEmbeddedSoundBank(this._midiData.embeddedSoundBank, this._midiData.bankOffset);
    if (this.preload) this._midiData.preloadSynth(this.synth);
  }
  this.currentMIDIPorts = this._midiData.tracks.map((t) => t.port);
  this.midiPortChannelOffset = 0;
  this.midiPortChannelOffsets = {};
  for (const [trackIndex, track] of this._midiData.tracks.entries()) this.assignMIDIPort(trackIndex, track.port);
  this.firstNoteTime = this._midiData.midiTicksToSeconds(this._midiData.firstNoteOn);
  SpessaLog.info(`%cTotal song time: ${formatTime(Math.ceil(this._midiData.duration)).time}`, ConsoleColors.recognized);
  this.callEvent("songChange", { songIndex: this._songIndex });
  if (this._midiData.duration <= 0.2) {
    SpessaLog.warn(`%cVery short song: (${formatTime(Math.round(this._midiData.duration)).time}). Disabling loop!`, ConsoleColors.warn);
    this.loopCount = 0;
  }
  this.currentTime = 0;
}
var DEFAULT_MIDI_CONTROLLERS = new Int16Array(128).fill(0);
var setResetValue = (i, v) => DEFAULT_MIDI_CONTROLLERS[i] = v << 7;
setResetValue(MIDIControllers.mainVolume, 100);
setResetValue(MIDIControllers.balance, 64);
setResetValue(MIDIControllers.expression, 127);
setResetValue(MIDIControllers.pan, 64);
setResetValue(MIDIControllers.filterResonance, 64);
setResetValue(MIDIControllers.releaseTime, 64);
setResetValue(MIDIControllers.attackTime, 64);
setResetValue(MIDIControllers.brightness, 64);
setResetValue(MIDIControllers.decayTime, 64);
setResetValue(MIDIControllers.vibratoRate, 64);
setResetValue(MIDIControllers.vibratoDepth, 64);
setResetValue(MIDIControllers.vibratoDelay, 64);
setResetValue(MIDIControllers.generalPurposeController6, 64);
setResetValue(MIDIControllers.generalPurposeController8, 64);
setResetValue(MIDIControllers.registeredParameterLSB, 127);
setResetValue(MIDIControllers.registeredParameterMSB, 127);
setResetValue(MIDIControllers.nonRegisteredParameterLSB, 0);
setResetValue(MIDIControllers.nonRegisteredParameterMSB, 0);
var DEFAULT_DRUM_REVERB = new Int8Array(128).fill(127);
DEFAULT_DRUM_REVERB[35] = 0;
DEFAULT_DRUM_REVERB[36] = 0;
function resetChannelInternal(sendCCEvents = true) {
  for (let cc = 0; cc < 128; cc++) {
    if (this.lockedControllers[cc]) {
      this.synthCore.callEvent("controllerChange", {
        channel: this.channel,
        controller: cc,
        value: this._midiControllers[cc] >> 7
      });
      continue;
    }
    const resetValue = DEFAULT_MIDI_CONTROLLERS[cc];
    if (this._midiControllers[cc] !== resetValue && cc !== MIDIControllers.portamentoControl && cc !== MIDIControllers.dataEntryMSB && cc !== MIDIControllers.registeredParameterMSB && cc !== MIDIControllers.registeredParameterLSB && cc !== MIDIControllers.nonRegisteredParameterMSB && cc !== MIDIControllers.nonRegisteredParameterLSB) this.controllerChange(cc, resetValue >> 7, sendCCEvents);
  }
  this.setMIDIParameter("pressure", 0);
  this.setMIDIParameter("pitchWheelRange", 2);
  this.setMIDIParameter("modulationDepth", 50);
  this.setMIDIParameter("rxChannel", this.channel);
  this.setMIDIParameter("efxAssign", false);
  this.setMIDIParameter("polyMode", true);
  this.setMIDIParameter("keyShift", 0);
  this.setMIDIParameter("fineTune", 0);
  this.setMIDIParameter("assignMode", 2);
  this.setMIDIParameter("randomPan", false);
  this.setMIDIParameter("cc1", 16);
  this.setMIDIParameter("cc2", 17);
  this.setMIDIParameter("drumMap", this.channel % 16 === 9 ? 1 : 0);
  this.setMIDIParameter("velocitySenseOffset", 64);
  this.setMIDIParameter("velocitySenseDepth", 64);
  this.pitchWheel(8192);
  this.octaveTuning.fill(0);
  this.lastPortamentoNote = this.channelSystem === "xg" ? 60 : -1;
  this.resetDrumParams();
  this.resetGeneratorOverrides();
  this.resetGeneratorOffsets();
  this.dynamicModulators.resetModulators();
  this.sf2NRPNGeneratorLSB = 0;
  this.playingNotes.fill(false);
  this.lastParameterIsRegistered = true;
  this._midiControllers[MIDIControllers.nonRegisteredParameterLSB] = 0;
  this._midiControllers[MIDIControllers.nonRegisteredParameterMSB] = 0;
  this._midiControllers[MIDIControllers.registeredParameterLSB] = 16256;
  this._midiControllers[MIDIControllers.registeredParameterMSB] = 16256;
  this._midiControllers[MIDIControllers.dataEntryMSB] = 0;
  this._midiControllers[MIDIControllers.dataEntryLSB] = 0;
  this.setBankMSB(BankSelectHacks.getDefaultBank(this.channelSystem));
  this.setBankLSB(0);
  this.setGSDrums(false);
  this.setDrums(this.channel % 16 === 9);
  this.programChange(0);
}
var RP_15_RESET_CC_NUMS = [
  MIDIControllers.modulationWheel,
  MIDIControllers.expression,
  MIDIControllers.sustainPedal,
  MIDIControllers.portamentoOnOff,
  MIDIControllers.sostenutoPedal,
  MIDIControllers.softPedal,
  MIDIControllers.registeredParameterMSB,
  MIDIControllers.registeredParameterLSB
];
function resetRP15() {
  this.pitchWheel(8192);
  this.setMIDIParameter("pressure", 0);
  for (const resetCC of RP_15_RESET_CC_NUMS) {
    const resetValue = DEFAULT_MIDI_CONTROLLERS[resetCC];
    if (resetValue !== this._midiControllers[resetCC]) this.controllerChange(resetCC, resetValue >> 7);
  }
}
var nonSkippableCCs = /* @__PURE__ */ new Set([
  MIDIControllers.dataDecrement,
  MIDIControllers.dataIncrement,
  MIDIControllers.dataEntryMSB,
  MIDIControllers.dataEntryLSB,
  MIDIControllers.registeredParameterLSB,
  MIDIControllers.registeredParameterMSB,
  MIDIControllers.nonRegisteredParameterLSB,
  MIDIControllers.nonRegisteredParameterMSB,
  MIDIControllers.bankSelect,
  MIDIControllers.bankSelectLSB,
  MIDIControllers.resetAllControllers,
  MIDIControllers.monoModeOn,
  MIDIControllers.polyModeOn
]);
function setTimeToInternal(time, ticks = void 0) {
  if (!this._midiData) return false;
  this.oneTickToSeconds = 60 / (120 * this._midiData.timeDivision);
  this.sendMIDIReset();
  this.playedTime = 0;
  this.index = 0;
  const channelsToSave = this.synth.midiChannels.length;
  const channels = [];
  for (let i = 0; i < channelsToSave; i++) channels.push({
    pitchWheel: 8192,
    controllers: new Int16Array(DEFAULT_MIDI_CONTROLLERS),
    param: new ParameterTracker(i),
    portamentoNote: -1
  });
  let savedTempo = void 0;
  let savedTempoTrack = 0;
  function resetAllControllers(chan) {
    const ch = channels[chan];
    ch.pitchWheel = 8192;
    ch.param.reset();
    for (const resetCC of RP_15_RESET_CC_NUMS) ch.controllers[resetCC] = DEFAULT_MIDI_CONTROLLERS[resetCC];
  }
  const { timeline, tracks } = this._midiData;
  while (true) {
    const e = timeline[this.index];
    const trackIndex = e.tr;
    const track = tracks[trackIndex];
    const event = track.events[e.ev];
    if (ticks === void 0) {
      if (this.playedTime >= time) break;
    } else if (event.ticks >= ticks) break;
    let status;
    let statusChannel = 0;
    if (event.statusByte >= 128 && event.statusByte < 240) {
      status = event.statusByte & 240;
      statusChannel = event.statusByte & 15;
    } else status = event.statusByte;
    const channel = statusChannel + (this.midiPortChannelOffsets[track.port] || 0);
    channels[channel] ??= {
      pitchWheel: 8192,
      controllers: new Int16Array(DEFAULT_MIDI_CONTROLLERS),
      param: new ParameterTracker(channel),
      portamentoNote: -1
    };
    const ch = channels[channel];
    switch (status) {
      case MIDIMessageTypes.noteOn:
        ch.portamentoNote = event.data[0];
        break;
      case MIDIMessageTypes.noteOff:
        break;
      case MIDIMessageTypes.pitchWheel:
        ch.pitchWheel = event.data[1] << 7 | event.data[0];
        break;
      case MIDIMessageTypes.systemExclusive: {
        const analyzed = MIDIUtils.analyzeSysEx(event.data);
        switch (analyzed.type) {
          default:
            this.processEvent(event, trackIndex);
            break;
          case "Controller Change": {
            const { controller, value, channel: channel2 } = analyzed;
            if (channel2 >= channelsToSave) break;
            if (this._midiData.isMultiPort && track.channels.size === 0) break;
            if (controller === MIDIControllers.resetAllControllers) {
              resetAllControllers(channel2);
              break;
            }
            if (nonSkippableCCs.has(controller)) this.sendMIDICC(channel2, controller, value);
            else channels[channel2].controllers[controller] = value << 7;
          }
        }
        break;
      }
      case MIDIMessageTypes.controllerChange: {
        if (this._midiData.isMultiPort && track.channels.size === 0) break;
        const controller = event.data[0];
        const value = event.data[1];
        switch (controller) {
          default:
            if (controller === MIDIControllers.resetAllControllers) {
              resetAllControllers(channel);
              break;
            }
            if (nonSkippableCCs.has(controller)) this.sendMIDICC(channel, controller, value);
            else ch.controllers[controller] = value << 7;
            break;
          case MIDIControllers.registeredParameterMSB:
          case MIDIControllers.registeredParameterLSB:
          case MIDIControllers.nonRegisteredParameterLSB:
          case MIDIControllers.nonRegisteredParameterMSB:
            ch.param.controllerChange(controller, value, 0, 0);
            this.sendMIDICC(channel, controller, value);
            break;
          case MIDIControllers.dataEntryMSB:
          case MIDIControllers.dataEntryLSB: {
            const analyzed = ch.param.controllerChange(controller, value, 0, 0);
            this.sendMIDICC(channel, controller, value);
            switch (analyzed.type) {
              default:
                break;
              case "Controller Change":
                if (nonSkippableCCs.has(analyzed.controller)) this.sendMIDICC(channel, analyzed.controller, analyzed.value);
                else ch.controllers[analyzed.controller] = analyzed.value << 7;
            }
            break;
          }
        }
        break;
      }
      case MIDIMessageTypes.setTempo: {
        const tempoBPM = 6e7 / readBigEndian(event.data, 3);
        this.oneTickToSeconds = 60 / (tempoBPM * this._midiData.timeDivision);
        savedTempo = event;
        savedTempoTrack = trackIndex;
        break;
      }
      default:
        this.processEvent(event, trackIndex);
        break;
    }
    const nE = timeline[++this.index];
    const nextEvent = tracks[nE.tr].events[nE.ev];
    if (nextEvent === void 0) {
      this.stop();
      return false;
    }
    this.playedTime += this.oneTickToSeconds * (nextEvent.ticks - event.ticks);
  }
  for (let channel = 0; channel < channelsToSave; channel++) {
    const ch = channels[channel];
    this.sendMIDIPitchWheel(channel, ch.pitchWheel);
    if (ch.portamentoNote >= 0) if (this.externalMIDIPlayback) this.sendMIDICC(channel, MIDIControllers.portamentoControl, ch.portamentoNote);
    else this.synth.midiChannels[channel].setLastNote(ch.portamentoNote);
    for (let i = 0; i < 128; i++) {
      const value = ch.controllers[i] >> 7;
      if (value !== DEFAULT_MIDI_CONTROLLERS[i] && !nonSkippableCCs.has(i)) this.sendMIDICC(channel, i, value);
    }
  }
  if (savedTempo) this.callEvent("metaEvent", {
    event: savedTempo,
    trackIndex: savedTempoTrack
  });
  if (this.paused) this.pausedTime = this.playedTime;
  return true;
}
var SpessaSynthSequencer = class {
  /**
  * Sequencer's song list.
  */
  songs = [];
  /**
  * The shuffled song indexes.
  * This is used when shuffle mode is enabled.
  */
  shuffledSongIndexes = [];
  /**
  * The synthesizer connected to the sequencer.
  */
  synth;
  /**
  * If the MIDI messages should be sent to an event instead of the synth.
  * This is used by spessasynth_lib to pass them over to Web MIDI API.
  */
  externalMIDIPlayback = false;
  /**
  * If the notes that were playing when the sequencer was paused should be re-triggered.
  * Defaults to true.
  */
  retriggerPausedNotes = true;
  /**
  * The loop count of the sequencer.
  * If set to Infinity, it will loop forever.
  * If set to zero, the loop is disabled.
  */
  loopCount = 0;
  /**
  * Indicates if the sequencer should skip to the first note on event.
  * Defaults to true.
  */
  skipToFirstNoteOn = true;
  /**
  * Indicates if the sequencer has finished playing.
  */
  isFinished = false;
  /**
  * Indicates if the synthesizer should preload the voices for the newly loaded sequence.
  * Recommended.
  */
  preload = true;
  /**
  * Called when the sequencer calls an event.
  * @param event The event
  */
  onEventCall;
  /**
  * Processes a single MIDI tick.
  * You should call this every rendering quantum to process the sequencer events in real-time.
  */
  processTick = processTick.bind(this);
  /**
  * The time of the first note in seconds.
  */
  firstNoteTime = 0;
  /**
  * How long a single MIDI tick currently lasts in seconds.
  */
  oneTickToSeconds = 0;
  /**
  * The current event index in the sorted event list.
  * This is used to track which event is currently being processed.
  * @protected
  */
  index = 0;
  /**
  * The time that has already been played in the current song.
  */
  playedTime = 0;
  /**
  * The paused time of the sequencer.
  * If the sequencer is not paused, this is undefined.
  */
  pausedTime = -1;
  /**
  * Absolute time of the sequencer when it started playing.
  * It is based on the synth's current time.
  */
  absoluteStartTime = 0;
  /**
  * Currently playing notes, for pressing them after pausing.
  * Map per channel, key: velocity.
  * If the `.get()` method returns nothing then this note is not playing.
  */
  playingNotes = [];
  /**
  * MIDI Port number for each of the MIDI tracks in the current sequence.
  */
  currentMIDIPorts = [];
  /**
  * This is used to assign new MIDI port offsets to new ports.
  */
  midiPortChannelOffset = 0;
  /**
  * Channel offsets for each MIDI port.
  * Stored as:
  * Record<midi port, channel offset>
  */
  midiPortChannelOffsets = {};
  assignMIDIPort = assignMIDIPortInternal.bind(this);
  loadNewSequence = loadNewSequenceInternal.bind(this);
  processEvent = processEventInternal.bind(this);
  setTimeTo = setTimeToInternal.bind(this);
  /**
  * Initializes a new Sequencer without any songs loaded.
  * @param spessasynthProcessor the synthesizer processor to use with this sequencer.
  */
  constructor(spessasynthProcessor) {
    this.synth = spessasynthProcessor;
    this.absoluteStartTime = this.synth.currentTime;
    this.playingNotes = this.synth.midiChannels.map(() => /* @__PURE__ */ new Map());
  }
  _midiData;
  /**
  * The currently loaded MIDI data.
  */
  get midiData() {
    return this._midiData;
  }
  /**
  * The length of the current sequence in seconds.
  */
  get duration() {
    return this._midiData?.duration ?? 0;
  }
  _songIndex = 0;
  /**
  * The current song index in the song list.
  * If shuffle mode is enabled, this is the index of the shuffled song list.
  */
  get songIndex() {
    return this._songIndex;
  }
  /**
  * The current song index in the song list.
  * If shuffle mode is enabled, this is the index of the shuffled song list.
  */
  set songIndex(value) {
    this._songIndex = value;
    this._songIndex = Math.max(0, value % this.songs.length);
    this.loadCurrentSong();
  }
  _shuffleMode = false;
  /**
  * Controls if the sequencer should shuffle the songs in the song list.
  * If true, the sequencer will play the songs in a random order.
  * Songs are shuffled on a `loadNewSongList` call.
  */
  get shuffleMode() {
    return this._shuffleMode;
  }
  /**
  * Controls if the sequencer should shuffle the songs in the song list.
  * If true, the sequencer will play the songs in a random order.
  * Songs are shuffled on a `loadNewSongList` call.
  */
  set shuffleMode(on) {
    this._shuffleMode = on;
  }
  /**
  * Internal playback rate.
  */
  _playbackRate = 1;
  /**
  * The sequencer's playback rate.
  * This is the rate at which the sequencer plays back the MIDI data.
  */
  get playbackRate() {
    return this._playbackRate;
  }
  /**
  * The sequencer's playback rate.
  * This is the rate at which the sequencer plays back the MIDI data.
  * @param value the playback rate to set.
  */
  set playbackRate(value) {
    const t = this.currentTime;
    this._playbackRate = value;
    this.recalculateStartTime(t);
  }
  /**
  * The current time of the sequencer.
  * This is the time in seconds since the sequencer started playing.
  */
  get currentTime() {
    if (this.pausedTime !== void 0) return this.pausedTime;
    return (this.synth.currentTime - this.absoluteStartTime) * this._playbackRate;
  }
  /**
  * The current time of the sequencer.
  * This is the time in seconds since the sequencer started playing.
  * @param time the time to set in seconds.
  */
  set currentTime(time) {
    if (!this._midiData) return;
    if (this.paused) this.pausedTime = time;
    if (time > this._midiData.duration || time < 0) if (this.skipToFirstNoteOn) this.setTimeTicks(this._midiData.firstNoteOn - 1);
    else this.setTimeTicks(0);
    else if (this.skipToFirstNoteOn && time < this.firstNoteTime) {
      this.setTimeTicks(this._midiData.firstNoteOn - 1);
      return;
    } else {
      for (const ch of this.playingNotes) ch.clear();
      this.callEvent("timeChange", { newTime: time });
      this.setTimeTo(time);
      this.recalculateStartTime(time);
    }
  }
  /**
  * True if paused, false if playing or stopped
  */
  get paused() {
    return this.pausedTime !== void 0;
  }
  /**
  * Starts or resumes the playback of the sequencer.
  * If the sequencer is paused, it will resume from the paused time.
  */
  play() {
    if (!this._midiData) {
      SpessaLog.warn("No songs loaded in the sequencer. Ignoring the play call.");
      return;
    }
    if (this.currentTime >= this._midiData.duration) this.currentTime = 0;
    if (this.paused) this.recalculateStartTime(this.pausedTime ?? 0);
    if (this.retriggerPausedNotes && !this.externalMIDIPlayback) for (let channel = 0; channel < this.playingNotes.length; channel++) {
      const ch = this.playingNotes[channel];
      for (const [midiNote, velocity] of ch) this.sendMIDINoteOn(channel, midiNote, velocity);
    }
    this.pausedTime = void 0;
  }
  /**
  * Pauses the playback.
  */
  pause() {
    this.pauseInternal(false);
  }
  /**
  * Loads a new song list into the sequencer.
  * @param midiBuffers the list of songs to load.
  */
  loadNewSongList(midiBuffers) {
    this.songs = midiBuffers;
    if (this.songs.length === 0) return;
    this._songIndex = 0;
    this.shuffleSongIndexes();
    this.callEvent("songListChange", { newSongList: [...this.songs] });
    if (this.preload) {
      SpessaLog.group("%cPreloading all songs...", ConsoleColors.info);
      for (const song of this.songs) if (song.embeddedSoundBank === void 0) song.preloadSynth(this.synth);
      SpessaLog.groupEnd();
    }
    this.loadCurrentSong();
  }
  callEvent(type, data) {
    this?.onEventCall?.({
      type,
      data
    });
  }
  pauseInternal(isFinished) {
    if (this.paused) return;
    this.stop();
    this.callEvent("pause", { isFinished });
    if (isFinished) this.callEvent("songEnded", {});
  }
  songIsFinished() {
    this.isFinished = true;
    if (this.songs.length === 1) {
      this.pauseInternal(true);
      return;
    }
    this._songIndex++;
    this._songIndex %= this.songs.length;
    this.loadCurrentSong();
  }
  /**
  * Stops the playback
  */
  stop() {
    this.pausedTime = this.currentTime;
    this.sendMIDIAllOff();
  }
  /**
  * Adds a new port (16 channels) to the synth.
  */
  addNewMIDIPort() {
    for (let i = 0; i < 16; i++) {
      this.synth.createMIDIChannel();
      this.playingNotes.push(/* @__PURE__ */ new Map());
    }
  }
  sendMIDIMessage(message) {
    if (!this.externalMIDIPlayback) {
      SpessaLog.warn(`Attempting to send ${arrayToHexString(message)} to the synthesizer via sendMIDIMessage. This shouldn't happen!`);
      return;
    }
    this.callEvent("midiMessage", {
      message,
      time: this.synth.currentTime
    });
  }
  sendMIDIAllOff() {
    for (let i = 0; i < 16; i++) this.sendMIDICC(i, MIDIControllers.sustainPedal, 0);
    if (!this.externalMIDIPlayback) {
      this.synth.stopAllChannels();
      return;
    }
    for (let channel = 0; channel < this.playingNotes.length; channel++) {
      const ch = this.playingNotes[channel];
      for (const midiNote of ch.keys()) this.sendMIDINoteOff(channel, midiNote);
    }
    for (let c = 0; c < 16; c++) this.sendMIDICC(c, MIDIControllers.allNotesOff, 0);
  }
  sendMIDIReset() {
    this.sendMIDIAllOff();
    if (!this.externalMIDIPlayback) {
      this.synth.reset();
      return;
    }
    this.sendMIDISysEx(MIDIUtils.gs(64, 0, 127, [0]));
  }
  loadCurrentSong() {
    let index = this._songIndex;
    if (this._shuffleMode) index = this.shuffledSongIndexes[this._songIndex];
    this.loadNewSequence(this.songs[index]);
  }
  shuffleSongIndexes() {
    const indexes = this.songs.map((_, i) => i);
    this.shuffledSongIndexes.length = 0;
    while (indexes.length > 0) {
      const index = indexes[Math.floor(Math.random() * indexes.length)];
      this.shuffledSongIndexes.push(index);
      indexes.splice(indexes.indexOf(index), 1);
    }
  }
  /**
  * Sets the time in MIDI ticks.
  * @param ticks the MIDI ticks to set the time to.
  */
  setTimeTicks(ticks) {
    if (!this._midiData) return;
    for (const ch of this.playingNotes) ch.clear();
    const seconds = this._midiData.midiTicksToSeconds(ticks);
    this.callEvent("timeChange", { newTime: seconds });
    const isNotFinished = this.setTimeTo(0, ticks);
    this.recalculateStartTime(this.playedTime);
    if (!isNotFinished) return;
  }
  /**
  * Recalculates the absolute start time of the sequencer.
  * @param time the time in seconds to recalculate the start time for.
  */
  recalculateStartTime(time) {
    this.absoluteStartTime = this.synth.currentTime - time / this._playbackRate;
  }
  /**
  * Jumps to a MIDI tick without any further processing.
  * @param targetTicks The MIDI tick to jump to.
  * @protected
  */
  jumpToTick(targetTicks) {
    if (!this._midiData) return;
    this.sendMIDIAllOff();
    const m = this._midiData;
    const seconds = m.midiTicksToSeconds(targetTicks);
    this.callEvent("timeChange", { newTime: seconds });
    this.recalculateStartTime(seconds);
    this.playedTime = seconds;
    const idx = m.timeline.findIndex((e) => m.tracks[e.tr].events[e.ev].ticks >= targetTicks);
    this.index = idx === -1 ? m.timeline.length : idx;
    const targetTempo = m.tempoChanges.find((t) => t.ticks <= targetTicks);
    this.oneTickToSeconds = 60 / (targetTempo.tempo * m.timeDivision);
  }
  sendMIDINoteOn(channel, midiNote, velocity) {
    if (!this.externalMIDIPlayback) {
      this.synth.noteOn(channel, midiNote, velocity);
      return;
    }
    channel %= 16;
    this.sendMIDIMessage([
      MIDIMessageTypes.noteOn | channel,
      midiNote,
      velocity
    ]);
  }
  sendMIDINoteOff(channel, midiNote) {
    if (!this.externalMIDIPlayback) {
      this.synth.noteOff(channel, midiNote);
      return;
    }
    channel %= 16;
    this.sendMIDIMessage([
      MIDIMessageTypes.noteOff | channel,
      midiNote,
      64
    ]);
  }
  sendMIDICC(channel, type, value) {
    if (!this.externalMIDIPlayback) {
      this.synth.controllerChange(channel, type, value);
      return;
    }
    channel %= 16;
    this.sendMIDIMessage([
      MIDIMessageTypes.controllerChange | channel,
      type,
      value
    ]);
  }
  sendMIDISysEx(syx) {
    if (!this.externalMIDIPlayback) {
      this.synth.systemExclusive(syx);
      return;
    }
    this.sendMIDIMessage([MIDIMessageTypes.systemExclusive, ...syx]);
  }
  /**
  * Sets the pitch of the given channel
  * @param channel usually 0-15: the channel to change pitch
  * @param pitch the 14-bit pitch value
  */
  sendMIDIPitchWheel(channel, pitch) {
    if (!this.externalMIDIPlayback) {
      this.synth.pitchWheel(channel, pitch);
      return;
    }
    channel %= 16;
    this.sendMIDIMessage([
      MIDIMessageTypes.pitchWheel | channel,
      pitch & 127,
      pitch >> 7
    ]);
  }
};
var InterpolationTypes = {
  linear: 0,
  nearestNeighbor: 1,
  hermite: 2
};
var stbvorbis = void 0 !== stbvorbis ? stbvorbis : {};
var isReady = false;
var readySolver;
stbvorbis.isInitialized = new Promise((A) => readySolver = A);
var atob = function(A) {
  var I, g, B, E, Q, C, i, h = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", o = "", G = 0;
  A = A.replace(/[^A-Za-z0-9\+\/\=]/g, "");
  do
    E = h.indexOf(A.charAt(G++)), Q = h.indexOf(A.charAt(G++)), C = h.indexOf(A.charAt(G++)), i = h.indexOf(A.charAt(G++)), I = E << 2 | Q >> 4, g = (15 & Q) << 4 | C >> 2, B = (3 & C) << 6 | i, o += String.fromCharCode(I), 64 !== C && (o += String.fromCharCode(g)), 64 !== i && (o += String.fromCharCode(B));
  while (G < A.length);
  return o;
};
(function() {
  var A, I, g, B, E, Q, h, a, S, s, w, y, c, $ = void 0 !== $ ? $ : {};
  $.wasmBinary = Uint8Array.from(atob("AGFzbQEAAAABpQEYYAJ/fwF/YAF/AGAAAX9gBH9/f38AYAAAYAN/f38Bf2ABfwF/YAJ/fwBgBn9/f39/fwF/YAR/f39/AX9gBX9/f39/AX9gB39/f39/f38Bf2AGf39/f39/AGAIf39/f39/f38Bf2AFf39/f38AYAd/f39/f39/AGADf39/AGABfwF9YAF9AX1gAnx/AXxgAnx/AX9gA3x8fwF8YAJ8fAF8YAF8AXwCngIPA2VudgZtZW1vcnkCAIACA2VudgV0YWJsZQFwAQQEA2Vudgl0YWJsZUJhc2UDfwADZW52DkRZTkFNSUNUT1BfUFRSA38AA2VudghTVEFDS1RPUAN/AANlbnYJU1RBQ0tfTUFYA38ABmdsb2JhbAhJbmZpbml0eQN8AANlbnYFYWJvcnQAAQNlbnYNZW5sYXJnZU1lbW9yeQACA2Vudg5nZXRUb3RhbE1lbW9yeQACA2VudhdhYm9ydE9uQ2Fubm90R3Jvd01lbW9yeQACA2Vudg5fX19hc3NlcnRfZmFpbAADA2VudgtfX19zZXRFcnJObwABA2VudgZfYWJvcnQABANlbnYWX2Vtc2NyaXB0ZW5fbWVtY3B5X2JpZwAFA3d2BgYCAQcHAQIBAQcBCAcFAAkGCQoHBgYGBgEFBgIBBgYKAAgLAAYGBgYGBgYBAAoMDAMGBQANCAoJAAwODA8OAQAGBgcEABAJEAERAAADBQwAAAMHBxIGAQAABwIFEwMOBw8HBgYQFAoVExYXFxcXFgQFBQYFAAYkB38BIwELfwEjAgt/ASMDC38BQQALfwFBAAt8ASMEC38BQQALB9MCFRBfX2dyb3dXYXNtTWVtb3J5AAgRX19fZXJybm9fbG9jYXRpb24AYwVfZnJlZQBfB19tYWxsb2MAXgdfbWVtY3B5AHkHX21lbXNldAB6BV9zYnJrAHsXX3N0Yl92b3JiaXNfanNfY2hhbm5lbHMAJhRfc3RiX3ZvcmJpc19qc19jbG9zZQAlFV9zdGJfdm9yYmlzX2pzX2RlY29kZQAoE19zdGJfdm9yYmlzX2pzX29wZW4AJBpfc3RiX3ZvcmJpc19qc19zYW1wbGVfcmF0ZQAnC2R5bkNhbGxfaWlpAHwTZXN0YWJsaXNoU3RhY2tTcGFjZQAMC2dldFRlbXBSZXQwAA8LcnVuUG9zdFNldHMAeAtzZXRUZW1wUmV0MAAOCHNldFRocmV3AA0Kc3RhY2tBbGxvYwAJDHN0YWNrUmVzdG9yZQALCXN0YWNrU2F2ZQAKCQoBACMACwR9VFl9Csb2A3YGACAAQAALGwEBfyMGIQEjBiAAaiQGIwZBD2pBcHEkBiABCwQAIwYLBgAgACQGCwoAIAAkBiABJAcLEAAjCEUEQCAAJAggASQJCwsGACAAJAsLBAAjCwsRACAABEAgABARIAAgABASCwvvBwEKfyAAQYADaiEHIAcoAgAhBQJAIAUEQCAAQfwBaiEEIAQoAgAhASABQQBKBEAgAEHwAGohCANAIAUgAkEYbGpBEGohCSAJKAIAIQEgAQRAIAgoAgAhAyAFIAJBGGxqQQ1qIQogCi0AACEGIAZB/wFxIQYgAyAGQbAQbGpBBGohAyADKAIAIQMgA0EASgRAQQAhAwNAIAEgA0ECdGohASABKAIAIQEgACABEBIgA0EBaiEDIAgoAgAhASAKLQAAIQYgBkH/AXEhBiABIAZBsBBsakEEaiEBIAEoAgAhBiAJKAIAIQEgAyAGSA0ACwsgACABEBILIAUgAkEYbGpBFGohASABKAIAIQEgACABEBIgAkEBaiECIAQoAgAhASACIAFODQMgBygCACEFDAAACwALCwsgAEHwAGohAyADKAIAIQEgAQRAIABB7ABqIQUgBSgCACECIAJBAEoEQEEAIQIDQAJAIAEgAkGwEGxqQQhqIQQgBCgCACEEIAAgBBASIAEgAkGwEGxqQRxqIQQgBCgCACEEIAAgBBASIAEgAkGwEGxqQSBqIQQgBCgCACEEIAAgBBASIAEgAkGwEGxqQaQQaiEEIAQoAgAhBCAAIAQQEiABIAJBsBBsakGoEGohASABKAIAIQEgAUUhBCABQXxqIQFBACABIAQbIQEgACABEBIgAkEBaiECIAUoAgAhASACIAFODQAgAygCACEBDAELCyADKAIAIQELIAAgARASCyAAQfgBaiEBIAEoAgAhASAAIAEQEiAHKAIAIQEgACABEBIgAEGIA2ohAyADKAIAIQEgAQRAIABBhANqIQUgBSgCACECIAJBAEoEQEEAIQIDQCABIAJBKGxqQQRqIQEgASgCACEBIAAgARASIAJBAWohAiAFKAIAIQcgAygCACEBIAIgB0gNAAsLIAAgARASCyAAQQRqIQIgAigCACEBIAFBAEoEQEEAIQEDQCAAQZQGaiABQQJ0aiEDIAMoAgAhAyAAIAMQEiAAQZQHaiABQQJ0aiEDIAMoAgAhAyAAIAMQEiAAQdgHaiABQQJ0aiEDIAMoAgAhAyAAIAMQEiABQQFqIQEgAigCACEDIAEgA0ghAyABQRBJIQUgBSADcQ0ACwtBACEBA0AgAEGgCGogAUECdGohAiACKAIAIQIgACACEBIgAEGoCGogAUECdGohAiACKAIAIQIgACACEBIgAEGwCGogAUECdGohAiACKAIAIQIgACACEBIgAEG4CGogAUECdGohAiACKAIAIQIgACACEBIgAEHACGogAUECdGohAiACKAIAIQIgACACEBIgAUEBaiEBIAFBAkcNAAsLGwAgAEHEAGohACAAKAIAIQAgAEUEQCABEF8LC3wBAX8gAEHUB2ohASABQQA2AgAgAEGAC2ohASABQQA2AgAgAEH4CmohASABQQA2AgAgAEGcCGohASABQQA2AgAgAEHVCmohASABQQA6AAAgAEH8CmohASABQQA2AgAgAEHUC2ohASABQQA2AgAgAEHYC2ohACAAQQA2AgAL8AQBB38jBiELIwZBEGokBiALQQhqIQcgC0EEaiEKIAshCCAAQSRqIQYgBiwAACEGAn8gBgR/IABBgAtqIQYgBigCACEGIAZBf0oEQCAFQQA2AgAgACABIAIQFgwCCyAAQRRqIQYgBiABNgIAIAEgAmohAiAAQRxqIQkgCSACNgIAIABB2ABqIQIgAkEANgIAIABBABAXIQkgCUUEQCAFQQA2AgBBAAwCCyAAIAcgCCAKEBghCSAJBEAgBygCACECIAgoAgAhCSAKKAIAIQggACACIAkgCBAaIQogByAKNgIAIABBBGohAiACKAIAIQggCEEASgRAQQAhAgNAIABBlAZqIAJBAnRqIQcgBygCACEHIAcgCUECdGohByAAQdQGaiACQQJ0aiEMIAwgBzYCACACQQFqIQIgAiAISA0ACwsgAwRAIAMgCDYCAAsgBSAKNgIAIABB1AZqIQAgBCAANgIAIAYoAgAhACAAIAFrDAILAkACQAJAAkACQCACKAIAIgNBIGsOBAECAgACCyACQQA2AgAgAEHUAGohAiAAEBkhAwJAIANBf0cEQANAIAIoAgAhAyADDQIgABAZIQMgA0F/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ACECIABBmAhqIQYgBigCACEHIAUgA2shCSAJIAdqIQkgAiAJSSEJIAIgB0khDSACIAdrIQJBACACIA0bIQIgAiADaiECIAIgBUohByAFIAIgBxshAiAJBEAgASACNgIAIAYoAgAhACAAIAJqIQAgBiAANgIAQQEMBgsLCyAAQfQKaiECIAIoAgAhAiADIB9rIQYgBiACaiEGIABBmAhqIQIgAiAGNgIAIAhBATYCAAwBBSAAQZgIaiECIAYNAQsMAQsgBCADayEDIAIoAgAhBCADIARqIQMgAiADNgIACyATKAIAIQIgAgRAIABByABqIQIgAigCACECIABB0ABqIQAgACgCACEAIAIgAEcEQEHTE0HEE0HkGkHnFBAECwsgASAFNgIAQQELIQAgHCQGIAALqAIBBX8gAEHoCmohBSAFKAIAIQICQCACQQBIBEBBACEABSACIAFIBEAgAUEYSgRAIABBGBAsIQIgAUFoaiEBIAAgARAsIQAgAEEYdCEAIAAgAmohACAADwsgAkUEQCAAQeQKaiECIAJBADYCAAsgAEHkCmohAwJAAkACQANAIAAQLiECIAJBf0YNASAFKAIAIQQgAiAEdCECIAMoAgAhBiAGIAJqIQIgAyACNgIAIAUgBEEIaiICNgIAIAIgAUgNAAwCAAsACyAFQX82AgBBACEADAQLIARBeEgEQEEAIQAMBAsLCyAAQeQKaiEEIAQoAgAhA0EBIAF0IQAgAEF/aiEAIAMgAHEhACADIAF2IQMgBCADNgIAIAIgAWshASAFIAE2AgALCyAAC40CAAJAIABBAEgEf0EABSAAQYCAAUgEQCAAQRBIBEAgAEGACGohACAALAAAIQAMAwsgAEGABEgEQCAAQQV2IQAgAEGACGohACAALAAAIQAgAEEFaiEABSAAQQp2IQAgAEGACGohACAALAAAIQAgAEEKaiEACwwCCyAAQYCAgAhIBH8gAEGAgCBIBH8gAEEPdiEAIABBgAhqIQAgACwAACEAIABBD2oFIABBFHYhACAAQYAIaiEAIAAsAAAhACAAQRRqCwUgAEGAgICAAkgEfyAAQRl2IQAgAEGACGohACAALAAAIQAgAEEZagUgAEEediEAIABBgAhqIQAgACwAACEAIABBHmoLCwshAAsgAAuiAQEDfyAAQdQKaiECIAIsAAAhAQJAAkAgAQ0AIABB3ApqIQEgASgCACEBIAEEQEF/IQMFIAAQLyEBIAEEQCACLAAAIQEgAQ0CQaEUQcQTQfYLQbUUEAQFQX8hAwsLDAELIAFBf2pBGHRBGHUhASACIAE6AAAgAEHsCmohASABKAIAIQIgAkEBaiECIAEgAjYCACAAEDAhACAAQf8BcSEDCyADC6wCAQd/IABB3ApqIQIgAigCACEBAkAgAUUEQCAAQdgKaiEEIAQoAgAhASABQX9GBEAgAEHQCGohASABKAIAIQEgAUF/aiEBIABB4ApqIQMgAyABNgIAIAAQMSEBIAFFBEAgAkEBNgIADAMLIABB0wpqIQEgASwAACEBIAFBAXEhASABBH8gBCgCAAUgAEEgEBUMAwshAQsgAUEBaiEHIAQgBzYCACAAQdQIaiABaiEDIAMsAAAhBiAGQf8BcSEDIAZBf0cEQCACQQE2AgAgAEHgCmohAiACIAE2AgALIABB0AhqIQEgASgCACEBIAcgAU4EQCAEQX82AgALIABB1ApqIQAgACwAACEBIAEEQEHFFEHEE0HoC0HaFBAEBSAAIAY6AAAgAyEFCwsLIAULUQEDfyAAQRRqIQMgAygCACEBIABBHGohAiACKAIAIQIgASACSQR/IAFBAWohACADIAA2AgAgASwAAAUgAEHUAGohACAAQQE2AgBBAAshACAACyABAX8gABAyIQEgAQR/IAAQMwUgAEEeEBVBAAshACAAC2ABAX8gABAwIQEgAUH/AXFBzwBGBEAgABAwIQEgAUH/AXFB5wBGBEAgABAwIQEgAUH/AXFB5wBGBEAgABAwIQAgAEH/AXFB0wBGIQAFQQAhAAsFQQAhAAsFQQAhAAsgAAvZAwEGfyAAEDAhAQJ/IAFB/wFxBH8gAEEfEBVBAAUgABAwIQEgAEHTCmohAiACIAE6AAAgABAjIQUgABAjIQIgABAjGiAAECMhASAAQcwIaiEDIAMgATYCACAAECMaIAAQMCEBIAFB/wFxIQEgAEHQCGohAyADIAE2AgAgAEHUCGohBCAAIAQgARAiIQEgAUUEQCAAQQoQFUEADAILIABB8ApqIQQgBEF+NgIAIAIgBXEhAQJAIAFBf0cEQCADKAIAIQEgAUEASgRAA0ACQCABQX9qIQIgAEHUCGogAmohBiAGLAAAIQYgBkF/Rw0AIAFBAUwNBCACIQEMAQsLIAQgAjYCACAAQfQKaiEBIAEgBTYCAAsLCyAAQdUKaiEBIAEsAAAhASABBEAgAygCACEDIANBAEoEf0EAIQJBACEBA0AgAEHUCGogAWohBCAELQAAIQQgBEH/AXEhBCACIARqIQIgAUEBaiEBIAEgA0gNAAsgAkEbagVBGwshASAAQShqIQIgAigCACECIAEgA2ohASABIAJqIQEgAEEsaiEDIAMgAjYCACAAQTBqIQIgAiABNgIAIABBNGohASABIAU2AgALIABB2ApqIQAgAEEANgIAQQELCyEAIAALowEBB38gAEHoCmohAyADKAIAIQECQCABQRlIBEAgAEHkCmohBCABRQRAIARBADYCAAsgAEHUCmohBSAAQdwKaiEGA0AgBigCACEBIAEEQCAFLAAAIQEgAUUNAwsgABAuIQIgAkF/Rg0CIAMoAgAhASACIAF0IQIgBCgCACEHIAcgAmohAiAEIAI2AgAgAUEIaiECIAMgAjYCACABQRFIDQALCwsLrQUBCX8gABA0IAFBIGohAiACKAIAIQUCQAJAIAVFIgNFDQAgAUGkEGohAiACKAIAIQIgAg0AQX8hAQwBCyABQQRqIQIgAigCACECAkACQCACQQhKBEAgAUGkEGohAyADKAIAIQMgAw0BBSADDQELDAELIABB5ApqIQggCCgCACEJIAkQOiEHIAFBrBBqIQIgAigCACECIAJBAUoEQCABQaQQaigCACEKQQAhAwNAIAJBAXYhBSAFIANqIQQgCiAEQQJ0aiEGIAYoAgAhBiAGIAdLIQYgAiAFayECIAMgBCAGGyEDIAUgAiAGGyECIAJBAUoNAAsFQQAhAwsgAUEXaiECIAIsAAAhAiACRQRAIAFBqBBqIQIgAigCACECIAIgA0ECdGohAiACKAIAIQMLIAFBCGohASABKAIAIQEgASADaiEBIAEtAAAhASABQf8BcSEBIABB6ApqIQIgAigCACEAIAAgAUgEf0EAIQBBfwUgACABayEAIAkgAXYhASAIIAE2AgAgAwshASACIAA2AgAMAQsgAUEXaiEDIAMsAAAhAyADBEBBgRVBxBNB6gxBjBUQBAsCQCACQQBKBEAgASgCCCEIIABB5ApqIQlBACEBA0ACQCAIIAFqIQMgAywAACEEIARB/wFxIQMgBEF/RwRAIAUgAUECdGoh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IwZBEGokBiACIQECfCAAvUIgiKdB/////wdxIgNB/MOk/wNJBHwgA0GewZryA0kEfEQAAAAAAADwPwUgAEQAAAAAAAAAABByCwUgACAAoSADQf//v/8HSw0BGgJAAkACQAJAIAAgARBuQQNxDgMAAQIDCyABKwMAIAErAwgQcgwECyABKwMAIAErAwhBARBwmgwDCyABKwMAIAErAwgQcpoMAgsgASsDACABKwMIQQEQcAsLIQAgAiQGIAALywEBA38jBiECIwZBEGokBiACIQECQCAAvUIgiKdB/////wdxIgNB/MOk/wNJBEAgA0GAgMDyA08EQCAARAAAAAAAAAAAQQAQcCEACwUgA0H//7//B0sEQCAAIAChIQAMAgsCQAJAAkACQAJAIAAgARBuQQNxDgMAAQIDCyABKwMAIAErAwhBARBwIQAMBQsgASsDACABKwMIEHIhAAwECyABKwMAIAErAwhBARBwmiEADAMLIAErAwAgASsDCBBymiEACwsLIAIkBiAAC5sDAwJ/AX4CfCAAvSIDQj+IpyEBAnwCfwJAIANCIIinQf////8HcSICQarGmIQESwR8IANC////////////AINCgICAgICAgPj/AFYEQCAADwsgAETvOfr+Qi6GQGQEQCAARAAAAAAAAOB/og8FIABE0rx63SsjhsBjIABEUTAt1RBJh8BjcUUNAkQAAAAAAAAAACIADwsABSACQcLc2P4DSwRAIAJBscXC/wNLDQIgAUEBcyABawwDCyACQYCAwPEDSwR8QQAhASAABSAARAAAAAAAAPA/oA8LCwwCCyAARP6CK2VHFfc/oiABQQN0QYATaisDAKCqCyEBIAAgAbciBEQAAOD+Qi7mP6KhIgAgBER2PHk17znqPaIiBaELIQQgACAEIAQgBCAEoiIAIAAgACAAIABE0KS+cmk3Zj6iRPFr0sVBvbu+oKJELN4lr2pWET+gokSTvb4WbMFmv6CiRD5VVVVVVcU/oKKhIgCiRAAAAAAAAABAIAChoyAFoaBEAAAAAAAA8D+gIQAgAUUEQCAADwsgACABEGULnwMDAn8BfgV8IAC9IgNCIIinIQECfyADQgBTIgIgAUGAgMAASXIEfyADQv///////////wCDQgBRBEBEAAAAAAAA8L8gACAAoqMPCyACRQRAIABEAAAAAAAAUEOivSIDQiCIpyEBIANC/////w+DIQNBy3cMAgsgACAAoUQAAAAAAAAAAKMPBSABQf//v/8HSwRAIAAPCyADQv////8PgyIDQgBRIAFBgIDA/wNGcQR/RAAAAAAAAAAADwVBgXgLCwshAiABQeK+JWoiAUH//z9xQZ7Bmv8Daq1CIIYgA4S/RAAAAAAAAPC/oCIFIAVEAAAAAAAA4D+ioiEGIAUgBUQAAAAAAAAAQKCjIgcgB6IiCCAIoiEEIAIgAUEUdmq3IgBEAADg/kIu5j+iIAUgAER2PHk17znqPaIgByAGIAQgBCAERJ/GeNAJmsM/okSveI4dxXHMP6CiRAT6l5mZmdk/oKIgCCAEIAQgBEREUj7fEvHCP6JE3gPLlmRGxz+gokRZkyKUJEnSP6CiRJNVVVVVVeU/oKKgoKKgIAahoKAL8Q8DC38Cfgh8AkACQAJAIAG9Ig1CIIinIgVB/////wdxIgMgDaciBnJFBEBEAAAAAAAA8D8PCyAAvSIOQiCIpyEHIA6nIghFIgogB0GAgMD/A0ZxBEBEAAAAAAAA8D8PCyAHQf////8HcSIEQYCAwP8HTQRAIAhBAEcgBEGAgMD/B0ZxIANBgIDA/wdLckUEQCAGQQBHIANBgIDA/wdGIgtxRQRAAkACQAJAIAdBAEgiCUUNACADQf///5kESwR/QQIhAgwBBSADQf//v/8DSwR/IANBFHYhAiADQf///4kESwRAQQIgBkGzCCACayICdiIMQQFxa0EAIAwgAnQgBkYbIQIMAwsgBgR/QQAFQQIgA0GTCCACayICdiIGQQFxa0EAIAYgAnQgA0YbIQIMBAsFDAILCyECDAILIAZFDQAMAQsgCwRAIARBgIDAgHxqIAhyRQRARAAAAAAAAPA/DwsgBUF/SiECIARB//+//wNLBEAgAUQAAAAAAAAAACACGw8FRAAAAAAAAAAAIAGaIAIbDwsACyADQYCAwP8DRgRAIABEAAAAAAAA8D8gAKMgBUF/ShsPCyAFQYCAgIAERgRAIAAgAKIPCyAHQX9KIAVBgICA/wNGcQRAIACfDwsLIACZIQ8gCgRAIARFIARBgICAgARyQYCAwP8HRnIEQEQAAAAAAADwPyAPoyAPIAVBAEgbIQAgCUUEQCAADwsgAiAEQYCAwIB8anIEQCAAmiAAIAJBAUYbDwsMBQsLAnwgCQR8AkACQAJAIAIOAgABAgsMBwtEAAAAAAAA8L8MAgtEAAAAAAAA8D8MAQVEAAAAAAAA8D8LCyERAnwgA0GAgICPBEsEfCADQYCAwJ8ESwRAIARBgIDA/wNJBEAjCkQAAAAAAAAAACAFQQBIGw8FIwpEAAAAAAAAAAAgBUEAShsPCwALIARB//+//wNJBEAgEUScdQCIPOQ3fqJEnHUAiDzkN36iIBFEWfP4wh9upQGiRFnz+MIfbqUBoiAFQQBIGw8LIARBgIDA/wNNBEAgD0QAAAAAAADwv6AiAEQAAABgRxX3P6IiECAARETfXfgLrlQ+oiAAIACiRAAAAAAAAOA/IABEVVVVVVVV1T8gAEQAAAAAAADQP6KhoqGiRP6CK2VHFfc/oqEiAKC9QoCAgIBwg78iEiEPIBIgEKEMAgsgEUScdQCIPOQ3fqJEnHUAiDzkN36iIBFEWfP4wh9upQGiRFnz+MIfbqUBoiAFQQBKGw8FIA9EAAAAAAAAQEOiIgC9QiCIpyAEIARBgIDAAEkiBRshAkHMd0GBeCAFGyACQRR1aiEDIAJB//8/cSIEQYCAwP8DciECIARBj7EOSQRAQQAhBAUgBEH67C5JIgYhBCADIAZBAXNBAXFqIQMgAiACQYCAQGogBhshAgsgBEEDdEGwE2orAwAiFCACrUIghiAAIA8gBRu9Qv////8Pg4S/IhAgBEEDdEGQE2orAwAiEqEiE0QAAAAAAADwPyASIBCgoyIVoiIPvUKAgICAcIO/IgAgACAAoiIWRAAAAAAAAAhAoCAPIACgIBUgEyACQQF1QYCAgIACckGAgCBqIARBEnRqrUIghr8iEyAAoqEgECATIBKhoSAAoqGiIhCiIA8gD6IiACAAoiAAIAAgACAAIABE705FSih+yj+iRGXbyZNKhs0/oKJEAUEdqWB00T+gokRNJo9RVVXVP6CiRP+rb9u2bds/oKJEAzMzMzMz4z+goqAiEqC9QoCAgIBwg78iAKIiEyAQIACiIA8gEiAARAAAAAAAAAjAoCAWoaGioCIPoL1CgICAgHCDvyIARAAAAOAJx+4/oiIQIARBA3RBoBNqKwMAIA8gACAToaFE/QM63AnH7j+iIABE9QFbFOAvPj6ioaAiAKCgIAO3IhKgvUKAgICAcIO/IhMhDyATIBKhIBShIBChCwshECAAIBChIAGiIAEgDUKAgICAcIO/IgChIA+ioCEBIA8gAKIiACABoCIPvSINQiCIpyECIA2nIQMgAkH//7+EBEoEQCACQYCAwPt7aiADciABRP6CK2VHFZc8oCAPIAChZHINBgUgAkGA+P//B3FB/5fDhARLBEAgAkGA6Lz7A2ogA3IgASAPIAChZXINBgsLIBEgAkH/////B3EiA0GAgID/A0sEfyAAQYCAQEGAgMAAIANBFHZBgnhqdiACaiIDQRR2Qf8PcSIEQYF4anUgA3GtQiCGv6EiDyEAIAEgD6C9IQ1BACADQf//P3FBgIDAAHJBkwggBGt2IgNrIAMgAkEASBsFQQALIgJBFHREAAAAAAAA8D8gDUKAgICAcIO/Ig9EAAAAAEMu5j+iIhAgASAPIAChoUTvOfr+Qi7mP6IgD0Q5bKgMYVwgPqKhIg+gIgAgACAAIACiIgEgASABIAEgAUTQpL5yaTdmPqJE8WvSxUG9u76gokQs3iWvalYRP6CiRJO9vhZswWa/oKJEPlVVVVVVxT+goqEiAaIgAUQAAAAAAAAAwKCjIA8gACAQoaEiASAAIAGioKEgAKGhIgC9Ig1CIIinaiIDQYCAwABIBHwgACACEGUFIAOtQiCGIA1C/////w+DhL8LIgCiDwsLCyAAIAGgDwsgACAAoSIAIACjDwsgEURZ8/jCH26lAaJEWfP4wh9upQGiDwsgEUScdQCIPOQ3fqJEnHUAiDzkN36iCwMAAQvDAwEDfyACQYDAAE4EQCAAIAEgAhAHDwsgACEEIAAgAmohAyAAQQNxIAFBA3FGBEADQCAAQQNxBEAgAkUEQCAEDwsgACABLAAAOgAAIABBAWohACABQQFqIQEgAkEBayECDAELCyADQXxxIgJBQGohBQNAIAAgBUwEQCAAIAEoAgA2AgAgACABKAIENgIEIAAgASgCCDYCCCAAIAEoAgw2AgwgACABKAIQNgIQIAAgASgCFDYCFCAAIAEoAhg2AhggACABKAIcNgIcIAAgASgCIDYCICAAIAEoAiQ2AiQgACABKAIoNgIoIAAgASgCLDYCLCAAIAEoAjA2AjAgACABKAI0NgI0IAAgASgCODYCOCAAIAEoAjw2AjwgAEFAayEAIAFBQGshAQwBCwsDQCAAIAJIBEAgACABKAIANgIAIABBBGohACABQQRqIQEMAQsLBSADQQRrIQIDQCAAIAJIBEAgACABLAAAOgAAIAAgASwAAToAASAAIAEsAAI6AAIgACABLAADOgADIABBBGohACABQQRqIQEMAQsLCwNAIAAgA0gEQCAAIAEsAAA6AAAgAEEBaiEAIAFBAWohAQwBCwsgBAuYAgEEfyAAIAJqIQQgAUH/AXEhASACQcMATgRAA0AgAEEDcQRAIAAgAToAACAAQQFqIQAMAQsLIARBfHEiBUFAaiEGIAEgAUEIdHIgAUEQdHIgAUEYdHIhAwNAIAAgBkwEQCAAIAM2AgAgACADNgIEIAAgAzYCCCAAIAM2AgwgACADNgIQIAAgAzYCFCAAIAM2AhggACADNgIcIAAgAzYCICAAIAM2AiQgACADNgIoIAAgAzYCLCAAIAM2AjAgACADNgI0IAAgAzYCOCAAIAM2AjwgAEFAayEADAELCwNAIAAgBUgEQCAAIAM2AgAgAEEEaiEADAELCwsDQCAAIARIBEAgACABOgAAIABBAWohAAwBCwsgBCACawtVAQJ/IABBAEojBSgCACIBIABqIgAgAUhxIABBAEhyBEAQAxpBDBAFQX8PCyMFIAA2AgAQAiECIAAgAkoEQBABRQRAIwUgATYCAEEMEAVBfw8LCyABCw4AIAEgAiAAQQNxEQAACwgAQQAQAEEACwvAEQQAQYEIC7YKAQICAwMDAwQEBAQEBAQEAAEAAIAAAABWAAAAQAAAAD605DMJkfMzi7IBNDwgCjQjGhM0YKkcNKfXJjRLrzE0UDs9NHCHSTQjoFY0uJJkNFVtczSIn4E0/AuKNJMEkzRpkpw0Mr+mND+VsTSTH7005GnJNK2A1jQ2ceQ0pknzNIiMATXA9wk1Bu8SNXZ7HDXApiY1N3sxNdoDPTVeTEk1O2FWNblPZDX8JXM1inmBNYbjiTV82ZI1hWScNVKOpjUzYbE1Jei8NdwuyTXOQdY1QS7kNVcC8zWPZgE2T88JNvXDEjaYTRw26HUmNjJHMTZ0zDw2XhFJNmUiVjbODGQ2uN5yNpdTgTYcu4k2cq6SNq82nDaBXaY2NS2xNsewvDbk88g2AQPWNmDr4zYeu/I2okABN+umCTfxmBI3yR8cNx5FJjc9EzE3HpU8N2/WSDei41U398ljN4mXcjevLYE3vpKJN3SDkjfmCJw3viymN0f5sDd5ebw3/rjIN0fE1TeSqOM3+HPyN8AaATiTfgk4+W0SOAbyGzhiFCY4Vt8wONhdPDiSm0g48qRVODOHYzhuUHI40weBOGtqiTiCWJI4KtubOAn8pThoxbA4O0K8OCl+yDighdU42WXjOOgs8jjp9AA5RlYJOQ5DEjlRxBs5teMlOX+rMDmiJjw5xWBIOVNmVTmDRGM5aAlyOQHigDkkQok5nS2SOXutmzljy6U5mZGwOQ0LvDlmQ8g5C0fVOTIj4znt5fE5Hc8AOgUuCTowGBI6qZYbOhWzJTq3dzA6fO87OgomSDrHJ1U65gFjOnjCcTo7vIA66RmJOsYCkjrbf5s6y5qlOthdsDrv07s6swjIOogI1Tqf4OI6B5/xOlypADvQBQk7Xu0ROw9pGzuEgiU7/UMwO2e4Ozth60c7TelUO12/Yjuce3E7f5aAO7rxiDv515E7R1KbO0FqpTsnKrA74py7OxLOxzsXytQ7IJ7iOzVY8TumgwA8p90IPJjCETyCOxs8AVIlPFQQMDxhgTs8yLBHPOWqVDzofGI81DRxPM9wgDyWyYg8Oq2RPMAkmzzFOaU8hfavPOVluzyCk8c8uYvUPLRb4jx5EfE8+10APYm1CD3flxE9Ag4bPY0hJT253C89bUo7PUB2Rz2RbFQ9hTpiPSLucD0qS4A9f6GIPYiCkT1I95o9WAmlPfLCrz34Lrs9A1nHPW1N1D1cGeI90crwPVs4AD53jQg+M20RPpDgGj4n8SQ+LqkvPocTOz7KO0c+TS5UPjf4YT6Ep3A+jyWAPnN5iD7iV5E+3MmaPvnYpD5tj68+G/i6PpUexz4zD9Q+F9fhPj2E8D7GEgA/cmUIP5NCET8rsxo/zsAkP7F1Lz+y3Do/ZQFHPx3wUz/7tWE/+2BwPwAAgD8DAAAABAAAAAQAAAAGAAAAg/miAERObgD8KRUA0VcnAN009QBi28AAPJmVAEGQQwBjUf4Au96rALdhxQA6biQA0k1CAEkG4AAJ6i4AHJLRAOsd/gApsRwA6D6nAPU1ggBEuy4AnOmEALQmcABBfl8A1pE5AFODOQCc9DkAi1+EACj5vQD4HzsA3v+XAA+YBQARL+8AClqLAG0fbQDPfjYACcsnAEZPtwCeZj8ALepfALondQDl68cAPXvxAPc5BwCSUooA+2vqAB+xXwAIXY0AMANWAHv8RgDwq2sAILzPADb0mgDjqR0AXmGRAAgb5gCFmWUAoBRfAI1AaACA2P8AJ3NNAAYGMQDKVhUAyahzAHviYABrjMAAQcMSC11A+yH5PwAAAAAtRHQ+AAAAgJhG+DwAAABgUcx4OwAAAICDG/A5AAAAQCAlejgAAACAIoLjNgAAAAAd82k1AAAAAAAA4D8AAAAAAADgvwAAAAAAAPA/AAAAAAAA+D8AQagTCwgG0M9D6/1MPgBBuxMLigZAA7jiP09nZ1MuL3N0Yl92b3JiaXMuYwBmLT5hbGxvYy5hbGxvY19idWZmZXJfbGVuZ3RoX2luX2J5dGVzID09IGYtPnRlbXBfb2Zmc2V0AHZvcmJpc19kZWNvZGVfaW5pdGlhbABmLT5ieXRlc19pbl9zZWcgPiAwAGdldDhfcGFja2V0X3JhdwBmLT5ieXRlc19pbl9zZWcgPT0gMABuZXh0X3NlZ21lbnQAdm9yYmlzX2RlY29kZV9wYWNrZXRfcmVzdAAhYy0+c3BhcnNlAGNvZGVib29rX2RlY29kZV9zY2FsYXJfcmF3ACFjLT5zcGFyc2UgfHwgeiA8IGMtPnNvcnRlZF9lbnRyaWVzAGNvZGVib29rX2RlY29kZV9kZWludGVybGVhdmVfcmVwZWF0AHogPCBjLT5zb3J0ZWRfZW50cmllcwBjb2RlYm9va19kZWNvZGVfc3RhcnQAKG4gJiAzKSA9PSAwAGltZGN0X3N0ZXAzX2l0ZXIwX2xvb3AAMABnZXRfd2luZG93AGYtPnRlbXBfb2Zmc2V0ID09IGYtPmFsbG9jLmFsbG9jX2J1ZmZlcl9sZW5ndGhfaW5fYnl0ZXMAc3RhcnRfZGVjb2RlcgB2b3JiaXNjLT5zb3J0ZWRfZW50cmllcyA9PSAwAGNvbXB1dGVfY29kZXdvcmRzAHogPj0gMCAmJiB6IDwgMzIAbGVuW2ldID49IDAgJiYgbGVuW2ldIDwgMzIAYXZhaWxhYmxlW3ldID09IDAAayA9PSBjLT5zb3J0ZWRfZW50cmllcwBjb21wdXRlX3NvcnRlZF9odWZmbWFuAGMtPnNvcnRlZF9jb2Rld29yZHNbeF0gPT0gY29kZQBsZW4gIT0gTk9fQ09ERQBpbmNsdWRlX2luX3NvcnQAcG93KChmbG9hdCkgcisxLCBkaW0pID4gZW50cmllcwBsb29rdXAxX3ZhbHVlcwAoaW50KSBmbG9vcihwb3coKGZsb2F0KSByLCBkaW0pKSA8PSBlbnRyaWVzAOoPBG5hbWUB4g9+AAVhYm9ydAENZW5sYXJnZU1lbW9yeQIOZ2V0VG90YWxNZW1vcnkDF2Fib3J0T25DYW5ub3RHcm93TWVtb3J5BA5fX19hc3NlcnRfZmFpbAULX19fc2V0RXJyTm8GBl9hYm9ydAcWX2Vtc2NyaXB0ZW5fbWVtY3B5X2JpZwgQX19ncm93V2FzbU1lbW9yeQkKc3RhY2tBbGxvYwoJc3RhY2tTYXZlCwxzdGFja1Jlc3RvcmUME2VzdGFibGlzaFN0YWNrU3BhY2UNCHNldFRocmV3DgtzZXRUZW1wUmV0MA8LZ2V0VGVtcFJldDAQEV9zdGJfdm9yYmlzX2Nsb3NlEQ5fdm9yYmlzX2RlaW5pdBILX3NldHVwX2ZyZWUTGl9zdGJfdm9yYmlzX2ZsdXNoX3B1c2hkYXRhFCFfc3RiX3ZvcmJpc19kZWNvZGVfZnJhbWVfcHVzaGRhdGEVBl9lcnJvchYgX3ZvcmJpc19zZWFyY2hfZm9yX3BhZ2VfcHVzaGRhdGEXGF9pc193aG9sZV9wYWNrZXRfcHJlc2VudBgVX3ZvcmJpc19kZWNvZGVfcGFja2V0GQxfZ2V0OF9wYWNrZXQaFF92b3JiaXNfZmluaXNoX2ZyYW1lGxlfc3RiX3ZvcmJpc19vcGVuX3B1c2hkYXRhHAxfdm9yYmlzX2luaXQdDl9zdGFydF9kZWNvZGVyHg1fdm9yYmlzX2FsbG9jHxtfc3RiX3ZvcmJpc19nZXRfZmlsZV9vZmZzZXQgE19tYXliZV9zdGFydF9wYWNrZXQhDV9mbHVzaF9wYWNrZXQiBV9nZXRuIwZfZ2V0MzIkE19zdGJfdm9yYmlzX2pzX29wZW4lFF9zdGJfdm9yYmlzX2pzX2Nsb3NlJhdfc3RiX3ZvcmJpc19qc19jaGFubmVscycaX3N0Yl92b3JiaXNfanNfc2FtcGxlX3JhdGUoFV9zdGJfdm9yYmlzX2pzX2RlY29kZSkNX2NyYzMyX3VwZGF0ZSoWX3ZvcmJpc19kZWNvZGVfaW5pdGlhbCsaX3ZvcmJpc19kZWNvZGVfcGFja2V0X3Jlc3QsCV9nZXRfYml0cy0FX2lsb2cuEF9nZXQ4X3BhY2tldF9yYXcvDV9uZXh0X3NlZ21lbnQwBV9nZXQ4MQtfc3RhcnRfcGFnZTIQX2NhcHR1cmVfcGF0dGVybjMdX3N0YXJ0X3BhZ2Vfbm9fY2FwdHVyZXBhdHRlcm40DV9wcmVwX2h1ZmZtYW41G19jb2RlYm9va19kZWNvZGVfc2NhbGFyX3JhdzYOX3ByZWRpY3RfcG9pbnQ3D19kZWNvZGVfcmVzaWR1ZTgJX2RvX2Zsb29yOQ1faW52ZXJzZV9tZGN0OgxfYml0X3JldmVyc2U7EV9tYWtlX2Jsb2NrX2FycmF5PBJfc2V0dXBfdGVtcF9tYWxsb2M9JF9jb2RlYm9va19kZWNvZGVfZGVpbnRlcmxlYXZlX3JlcGVhdD4PX3Jlc2lkdWVfZGVjb2RlPxVfY29kZWJvb2tfZGVjb2RlX3N0ZXBAEF9jb2RlYm9va19kZWNvZGVBFl9jb2RlYm9va19kZWNvZGVfc3RhcnRCCl9kcmF3X2xpbmVDF19pbWRjdF9zdGVwM19pdGVyMF9sb29wRBlfaW1kY3Rfc3RlcDNfaW5uZXJfcl9sb29wRRlfaW1kY3Rfc3RlcDNfaW5uZXJfc19sb29wRh9faW1kY3Rfc3RlcDNfaW5uZXJfc19sb29wX2xkNjU0RwhfaXRlcl81NEgLX2dldF93aW5kb3dJEF92b3JiaXNfdmFsaWRhdGVKDV9zdGFydF9wYWNrZXRLBV9za2lwTAtfY3JjMzJfaW5pdE0NX3NldHVwX21hbGxvY04QX3NldHVwX3RlbXBfZnJlZU8SX2NvbXB1dGVfY29kZXdvcmRzUBdfY29tcHV0ZV9zb3J0ZWRfaHVmZm1hblEcX2NvbXB1dGVfYWNjZWxlcmF0ZWRfaHVmZm1hblIPX2Zsb2F0MzJfdW5wYWNrUw9fbG9va3VwMV92YWx1ZXNUDl9wb2ludF9jb21wYXJlVQpfbmVpZ2hib3JzVg9faW5pdF9ibG9ja3NpemVXCl9hZGRfZW50cnlYEF9pbmNsdWRlX2luX3NvcnRZD191aW50MzJfY29tcGFyZVoYX2NvbXB1dGVfdHdpZGRsZV9mYWN0b3JzWw9fY29tcHV0ZV93aW5kb3dcE19jb21wdXRlX2JpdHJldmVyc2VdB19zcXVhcmVeB19tYWxsb2NfBV9mcmVlYAhfcmVhbGxvY2ESX3RyeV9yZWFsbG9jX2NodW5rYg5fZGlzcG9zZV9jaHVua2MRX19fZXJybm9fbG9jYXRpb25kB19tZW1jbXBlB19zY2FsYm5mBl9xc29ydGcFX3NpZnRoBF9zaHJpCF90cmlua2xlagRfc2hsawVfcG50emwIX2FfY3R6X2xtBl9jeWNsZW4LX19fcmVtX3BpbzJvEV9fX3JlbV9waW8yX2xhcmdlcAZfX19zaW5xBl9sZGV4cHIGX19fY29zcwRfY29zdARfc2ludQRfZXhwdgRfbG9ndwRfcG93eAtydW5Qb3N0U2V0c3kHX21lbWNweXoHX21lbXNldHsFX3Nicmt8C2R5bkNhbGxfaWlpfQJiMA=="), function(A4) {
    return A4.charCodeAt(0);
  });
  var $ = void 0 !== $ ? $ : {}, e = {};
  for (A in $) $.hasOwnProperty(A) && (e[A] = $[A]);
  $.arguments = [], $.thisProgram = "./this.program", $.quit = function(A4, I2) {
    throw I2;
  }, $.preRun = [], $.postRun = [];
  var t = false, k = false, N = false, r = false;
  t = "object" == typeof window, k = "function" == typeof importScripts, N = "object" == typeof process && "function" == typeof aaa && !t && !k, r = !t && !N && !k;
  var Y = "";
  function J(A4) {
    return $.locateFile ? $.locateFile(A4, Y) : Y + A4;
  }
  N ? (Y = "/", $.read = function A4(B2, E2) {
    var Q2;
    return I || (I = void 0), g || (g = void 0), B2 = g.normalize(B2), Q2 = I.readFileSync(B2), E2 ? Q2 : Q2.toString();
  }, $.readBinary = function A4(I2) {
    var g2 = $.read(I2, true);
    return g2.buffer || (g2 = new Uint8Array(g2)), _(g2.buffer), g2;
  }, process.argv.length > 1 && ($.thisProgram = process.argv[1].replace(/\\/g, "/")), $.arguments = process.argv.slice(2), process.on("uncaughtException", function(A4) {
    if (!(A4 instanceof II)) throw A4;
  }), process.on("unhandledRejection", function(A4, I2) {
    process.exit(1);
  }), $.quit = function(A4) {
    process.exit(A4);
  }, $.inspect = function() {
    return "[Emscripten Module object]";
  }) : r ? ("undefined" != typeof read && ($.read = function A4(I2) {
    return read(I2);
  }), $.readBinary = function A4(I2) {
    var g2;
    return "function" == typeof readbuffer ? new Uint8Array(readbuffer(I2)) : (_("object" == typeof (g2 = read(I2, "binary"))), g2);
  }, "undefined" != typeof scriptArgs ? $.arguments = scriptArgs : "undefined" != typeof arguments && ($.arguments = arguments), "function" == typeof quit && ($.quit = function(A4) {
    quit(A4);
  })) : (t || k) && (t ? document.currentScript && (Y = document.currentScript.src) : Y = self.location.href, Y = 0 !== Y.indexOf("blob:") ? Y.split("/").slice(0, -1).join("/") + "/" : "", $.read = function A4(I2) {
    var g2 = new XMLHttpRequest();
    return g2.open("GET", I2, false), g2.send(null), g2.responseText;
  }, k && ($.readBinary = function A4(I2) {
    var g2 = new XMLHttpRequest();
    return g2.open("GET", I2, false), g2.responseType = "arraybuffer", g2.send(null), new Uint8Array(g2.response);
  }), $.readAsync = function A4(I2, g2, B2) {
    var E2 = new XMLHttpRequest();
    E2.open("GET", I2, true), E2.responseType = "arraybuffer", E2.onload = function A8() {
      if (200 == E2.status || 0 == E2.status && E2.response) {
        g2(E2.response);
        return;
      }
      B2();
    }, E2.onerror = B2, E2.send(null);
  }, $.setWindowTitle = function(A4) {
    document.title = A4;
  });
  var f = $.print || ("undefined" != typeof console ? console.log.bind(console) : "undefined" != typeof print ? print : null), H = $.printErr || ("undefined" != typeof printErr ? printErr : "undefined" != typeof console && console.warn.bind(console) || f);
  for (A in e) e.hasOwnProperty(A) && ($[A] = e[A]);
  function L(A4) {
    var I2 = S;
    return S = S + A4 + 15 & -16, I2;
  }
  function d(A4, I2) {
    return I2 || (I2 = 16), A4 = Math.ceil(A4 / I2) * I2;
  }
  function K(A4) {
    K.shown || (K.shown = {}), K.shown[A4] || (K.shown[A4] = 1, H(A4));
  }
  e = void 0;
  var l = {
    "f64-rem": function(A4, I2) {
      return A4 % I2;
    },
    debugger: function() {
    }
  }, p = 0;
  function _(A4, I2) {
    A4 || IE("Assertion failed: " + I2);
  }
  function T(A4) {
    var I2 = $["_" + A4];
    return _(I2, "Cannot call unknown function " + A4 + ", make sure it is exported"), I2;
  }
  var v = {
    stackSave: function() {
      IA();
    },
    stackRestore: function() {
      A9();
    },
    arrayToC: function(A4) {
      var I2, g2, B2 = A5(A4.length);
      return I2 = A4, g2 = B2, E.set(I2, g2), B2;
    },
    stringToC: function(A4) {
      var I2 = 0;
      if (null != A4 && 0 !== A4) {
        var g2 = (A4.length << 2) + 1;
        I2 = A5(g2), Ai(A4, I2, g2);
      }
      return I2;
    }
  }, O = {
    string: v.stringToC,
    array: v.arrayToC
  };
  function j(A4, I2, g2, B2, E2) {
    var Q2 = T(A4), C = [], i = 0;
    if (B2) for (var h2 = 0; h2 < B2.length; h2++) {
      var o = O[g2[h2]];
      o ? (0 === i && (i = IA()), C[h2] = o(B2[h2])) : C[h2] = B2[h2];
    }
    var G, D = Q2.apply(null, C);
    return D = (G = D, "string" === I2 ? Ag(G) : "boolean" === I2 ? Boolean(G) : G), 0 !== i && A9(i), D;
  }
  function Ag(A4, I2) {
    if (0 === I2 || !A4) return "";
    for (var g2, B2, E2, C = 0, i = 0; C |= B2 = Q[A4 + i >> 0], (0 != B2 || I2) && (i++, !I2 || i != I2); ) ;
    I2 || (I2 = i);
    var h2 = "";
    if (C < 128) {
      for (; I2 > 0; ) E2 = String.fromCharCode.apply(String, Q.subarray(A4, A4 + Math.min(I2, 1024))), h2 = h2 ? h2 + E2 : E2, A4 += 1024, I2 -= 1024;
      return h2;
    }
    return g2 = A4, (function A8(I3, g3) {
      for (var B3 = g3; I3[B3]; ) ++B3;
      if (B3 - g3 > 16 && I3.subarray && AQ) return AQ.decode(I3.subarray(g3, B3));
      for (var E3, Q2, C2, i2, h3, G = ""; ; ) {
        if (!(E3 = I3[g3++])) return G;
        if (!(128 & E3)) {
          G += String.fromCharCode(E3);
          continue;
        }
        if (Q2 = 63 & I3[g3++], (224 & E3) == 192) {
          G += String.fromCharCode((31 & E3) << 6 | Q2);
          continue;
        }
        if (C2 = 63 & I3[g3++], (240 & E3) == 224 ? E3 = (15 & E3) << 12 | Q2 << 6 | C2 : (i2 = 63 & I3[g3++], (248 & E3) == 240 ? E3 = (7 & E3) << 18 | Q2 << 12 | C2 << 6 | i2 : (h3 = 63 & I3[g3++], E3 = (252 & E3) == 248 ? (3 & E3) << 24 | Q2 << 18 | C2 << 12 | i2 << 6 | h3 : (1 & E3) << 30 | Q2 << 24 | C2 << 18 | i2 << 12 | h3 << 6 | 63 & I3[g3++])), E3 < 65536) G += String.fromCharCode(E3);
        else {
          var D = E3 - 65536;
          G += String.fromCharCode(55296 | D >> 10, 56320 | 1023 & D);
        }
      }
    })(Q, g2);
  }
  var AQ = "undefined" != typeof TextDecoder ? new TextDecoder("utf8") : void 0;
  function AC(A4, I2, g2, B2) {
    if (!(B2 > 0)) return 0;
    for (var E2 = g2, Q2 = g2 + B2 - 1, C = 0; C < A4.length; ++C) {
      var i = A4.charCodeAt(C);
      if (i >= 55296 && i <= 57343 && (i = 65536 + ((1023 & i) << 10) | 1023 & A4.charCodeAt(++C)), i <= 127) {
        if (g2 >= Q2) break;
        I2[g2++] = i;
      } else if (i <= 2047) {
        if (g2 + 1 >= Q2) break;
        I2[g2++] = 192 | i >> 6, I2[g2++] = 128 | 63 & i;
      } else if (i <= 65535) {
        if (g2 + 2 >= Q2) break;
        I2[g2++] = 224 | i >> 12, I2[g2++] = 128 | i >> 6 & 63, I2[g2++] = 128 | 63 & i;
      } else if (i <= 2097151) {
        if (g2 + 3 >= Q2) break;
        I2[g2++] = 240 | i >> 18, I2[g2++] = 128 | i >> 12 & 63, I2[g2++] = 128 | i >> 6 & 63, I2[g2++] = 128 | 63 & i;
      } else if (i <= 67108863) {
        if (g2 + 4 >= Q2) break;
        I2[g2++] = 248 | i >> 24, I2[g2++] = 128 | i >> 18 & 63, I2[g2++] = 128 | i >> 12 & 63, I2[g2++] = 128 | i >> 6 & 63, I2[g2++] = 128 | 63 & i;
      } else {
        if (g2 + 5 >= Q2) break;
        I2[g2++] = 252 | i >> 30, I2[g2++] = 128 | i >> 24 & 63, I2[g2++] = 128 | i >> 18 & 63, I2[g2++] = 128 | i >> 12 & 63, I2[g2++] = 128 | i >> 6 & 63, I2[g2++] = 128 | 63 & i;
      }
    }
    return I2[g2] = 0, g2 - E2;
  }
  function Ai(A4, I2, g2) {
    return AC(A4, Q, I2, g2);
  }
  "undefined" != typeof TextDecoder && new TextDecoder("utf-16le");
  function An(A4, I2) {
    return A4 % I2 > 0 && (A4 += I2 - A4 % I2), A4;
  }
  function AU(A4) {
    $.buffer = B = A4;
  }
  function A$() {
    $.HEAP8 = E = new Int8Array(B), $.HEAP16 = new Int16Array(B), $.HEAP32 = h = new Int32Array(B), $.HEAPU8 = Q = new Uint8Array(B), $.HEAPU16 = new Uint16Array(B), $.HEAPU32 = new Uint32Array(B), $.HEAPF32 = new Float32Array(B), $.HEAPF64 = new Float64Array(B);
  }
  function Ae() {
    var A4 = $.usingWasm ? 65536 : 16777216, I2 = 2147483648 - A4;
    if (h[c >> 2] > I2) return false;
    var g2 = AN;
    for (AN = Math.max(AN, 16777216); AN < h[c >> 2]; ) AN = AN <= 536870912 ? An(2 * AN, A4) : Math.min(An((3 * AN + 2147483648) / 4, A4), I2);
    var B2 = $.reallocBuffer(AN);
    return B2 && B2.byteLength == AN ? (AU(B2), A$(), true) : (AN = g2, false);
  }
  a = S = s = w = y = c = 0, $.reallocBuffer || ($.reallocBuffer = function(A4) {
    try {
      if (ArrayBuffer.transfer) I2 = ArrayBuffer.transfer(B, A4);
      else {
        var I2, g2 = E;
        I2 = new ArrayBuffer(A4), new Int8Array(I2).set(g2);
      }
    } catch (Q2) {
      return false;
    }
    return !!Az(I2) && I2;
  });
  try {
    Function.prototype.call.bind(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get)(/* @__PURE__ */ new ArrayBuffer(4));
  } catch (At) {
  }
  var Ak = $.TOTAL_STACK || 5242880, AN = $.TOTAL_MEMORY || 16777216;
  function Ar() {
    return AN;
  }
  function AY(A4) {
    for (; A4.length > 0; ) {
      var I2 = A4.shift();
      if ("function" == typeof I2) {
        I2();
        continue;
      }
      var g2 = I2.func;
      "number" == typeof g2 ? void 0 === I2.arg ? $.dynCall_v(g2) : $.dynCall_vi(g2, I2.arg) : g2(void 0 === I2.arg ? null : I2.arg);
    }
  }
  AN < Ak && H("TOTAL_MEMORY should be larger than TOTAL_STACK, was " + AN + "! (TOTAL_STACK=" + Ak + ")"), $.buffer ? B = $.buffer : ("object" == typeof WebAssembly && "function" == typeof WebAssembly.Memory ? ($.wasmMemory = new WebAssembly.Memory({ initial: AN / 65536 }), B = $.wasmMemory.buffer) : B = new ArrayBuffer(AN), $.buffer = B), A$();
  var AJ = [], Af = [], AH = [], AM = [], A0 = false;
  function Aq(A4) {
    AJ.unshift(A4);
  }
  function Ab(A4) {
    AM.unshift(A4);
  }
  var A6 = Math.floor, A7 = 0, A1 = null, AW = null;
  $.preloadedImages = {}, $.preloadedAudios = {};
  var AT = "data:application/octet-stream;base64,";
  function A2(A4) {
    return String.prototype.startsWith ? A4.startsWith(AT) : 0 === A4.indexOf(AT);
  }
  (function A4() {
    var I2 = "main.wast", g2 = "main.wasm", B2 = "main.temp.asm";
    A2(I2) || (I2 = J(I2)), A2(g2) || (g2 = J(g2)), A2(B2) || (B2 = J(B2));
    var E2 = {
      global: null,
      env: null,
      asm2wasm: l,
      parent: $
    }, Q2 = null;
    function i() {
      try {
        if ($.wasmBinary) return new Uint8Array($.wasmBinary);
        if ($.readBinary) return $.readBinary(g2);
        throw "both async and sync fetching of the wasm failed";
      } catch (A8) {
        IE(A8);
      }
    }
    $.asmPreload = $.asm;
    var h2 = $.reallocBuffer, o = function(A8) {
      A8 = An(A8, $.usingWasm ? 65536 : 16777216);
      var I3 = $.buffer.byteLength;
      if ($.usingWasm) try {
        if (-1 !== $.wasmMemory.grow((A8 - I3) / 65536)) return $.buffer = $.wasmMemory.buffer;
        return null;
      } catch (B3) {
        return null;
      }
    };
    $.reallocBuffer = function(A8) {
      return "asmjs" === G ? h2(A8) : o(A8);
    };
    var G = "";
    $.asm = function(A8, I3, B3) {
      if (!(I3 = I3).table) {
        var h3, o2 = $.wasmTableSize;
        void 0 === o2 && (o2 = 1024);
        var G2 = $.wasmMaxTableSize;
        "object" == typeof WebAssembly && "function" == typeof WebAssembly.Table ? void 0 !== G2 ? I3.table = new WebAssembly.Table({
          initial: o2,
          maximum: G2,
          element: "anyfunc"
        }) : I3.table = new WebAssembly.Table({
          initial: o2,
          element: "anyfunc"
        }) : I3.table = Array(o2), $.wasmTable = I3.table;
      }
      return I3.memoryBase || (I3.memoryBase = $.STATIC_BASE), I3.tableBase || (I3.tableBase = 0), h3 = (function A10(I4, B4, C) {
        if ("object" != typeof WebAssembly) return H("no native wasm support detected"), false;
        if (!($.wasmMemory instanceof WebAssembly.Memory)) return H("no native wasm Memory in use"), false;
        function h4(A11, I5) {
          if ((Q2 = A11.exports).memory) {
            var g3 = Q2.memory, B5 = $.buffer, E3;
            g3.byteLength < B5.byteLength && H("the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here"), E3 = new Int8Array(B5), new Int8Array(g3).set(E3), AU(g3), A$();
          }
          $.asm = Q2, $.usingWasm = true, (function A12(I6) {
            if (A7--, $.monitorRunDependencies && $.monitorRunDependencies(A7), 0 == A7 && (null !== A1 && (clearInterval(A1), A1 = null), AW)) {
              var g4 = AW;
              AW = null, g4();
            }
          })("wasm-instantiate");
        }
        B4.memory = $.wasmMemory, E2.global = {
          NaN: NaN,
          Infinity: Infinity
        }, E2["global.Math"] = Math, E2.env = B4;
        if (A7++, $.monitorRunDependencies && $.monitorRunDependencies(A7), $.instantiateWasm) try {
          return $.instantiateWasm(E2, h4);
        } catch (o3) {
          return H("Module.instantiateWasm callback failed with error: " + o3), false;
        }
        function G3(A11) {
          h4(A11.instance, A11.module);
        }
        function D(A11) {
          (!$.wasmBinary && (t || k) && "function" == typeof fetch ? fetch(g2, { credentials: "same-origin" }).then(function(A12) {
            if (!A12.ok) throw "failed to load wasm binary file at '" + g2 + "'";
            return A12.arrayBuffer();
          }).catch(function() {
            return i();
          }) : new Promise(function(A12, I5) {
            A12(i());
          })).then(function(A12) {
            return WebAssembly.instantiate(A12, E2);
          }).then(A11).catch(function(A12) {
            H("failed to asynchronously prepare wasm: " + A12), IE(A12);
          });
        }
        return $.wasmBinary || "function" != typeof WebAssembly.instantiateStreaming || A2(g2) || "function" != typeof fetch ? D(G3) : WebAssembly.instantiateStreaming(fetch(g2, { credentials: "same-origin" }), E2).then(G3).catch(function(A11) {
          H("wasm streaming compile failed: " + A11), H("falling back to ArrayBuffer instantiation"), D(G3);
        }), {};
      })(A8, I3, B3), _(h3, "no binaryen method succeeded."), h3;
    }, $.asm;
  })(), S = (a = 1024) + 4816, Af.push(), $.STATIC_BASE = a, $.STATIC_BUMP = 4816;
  var Av = S;
  S += 16, c = L(4), w = (s = d(S)) + Ak, y = d(w), h[c >> 2] = y, $.wasmTableSize = 4, $.wasmMaxTableSize = 4, $.asmGlobalArg = {}, $.asmLibraryArg = {
    abort: IE,
    assert: _,
    enlargeMemory: Ae,
    getTotalMemory: Ar,
    abortOnCannotGrowMemory: function A4() {
      IE("Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value " + AN + ", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ");
    },
    invoke_iii: function A4(I2, g2, B2) {
      var E2 = IA();
      try {
        return $.dynCall_iii(I2, g2, B2);
      } catch (Q2) {
        if (A9(E2), "number" != typeof Q2 && "longjmp" !== Q2) throw Q2;
        $.setThrew(1, 0);
      }
    },
    ___assert_fail: function A4(I2, g2, B2, E2) {
      IE("Assertion failed: " + Ag(I2) + ", at: " + [
        g2 ? Ag(g2) : "unknown filename",
        B2,
        E2 ? Ag(E2) : "unknown function"
      ]);
    },
    ___setErrNo: function A4(I2) {
      return $.___errno_location && (h[$.___errno_location() >> 2] = I2), I2;
    },
    _abort: function A4() {
      $.abort();
    },
    _emscripten_memcpy_big: function A4(I2, g2, B2) {
      return Q.set(Q.subarray(g2, g2 + B2), I2), I2;
    },
    _llvm_floor_f64: A6,
    DYNAMICTOP_PTR: c,
    tempDoublePtr: Av,
    ABORT: p,
    STACKTOP: s,
    STACK_MAX: w
  };
  var A3 = $.asm($.asmGlobalArg, $.asmLibraryArg, B);
  $.asm = A3, $.___errno_location = function() {
    return $.asm.___errno_location.apply(null, arguments);
  };
  var Az = $._emscripten_replace_memory = function() {
    return $.asm._emscripten_replace_memory.apply(null, arguments);
  };
  $._free = function() {
    return $.asm._free.apply(null, arguments);
  };
  $._malloc = function() {
    return $.asm._malloc.apply(null, arguments);
  };
  $._memcpy = function() {
    return $.asm._memcpy.apply(null, arguments);
  }, $._memset = function() {
    return $.asm._memset.apply(null, arguments);
  }, $._sbrk = function() {
    return $.asm._sbrk.apply(null, arguments);
  }, $._stb_vorbis_js_channels = function() {
    return $.asm._stb_vorbis_js_channels.apply(null, arguments);
  }, $._stb_vorbis_js_close = function() {
    return $.asm._stb_vorbis_js_close.apply(null, arguments);
  }, $._stb_vorbis_js_decode = function() {
    return $.asm._stb_vorbis_js_decode.apply(null, arguments);
  }, $._stb_vorbis_js_open = function() {
    return $.asm._stb_vorbis_js_open.apply(null, arguments);
  }, $._stb_vorbis_js_sample_rate = function() {
    return $.asm._stb_vorbis_js_sample_rate.apply(null, arguments);
  }, $.establishStackSpace = function() {
    return $.asm.establishStackSpace.apply(null, arguments);
  }, $.getTempRet0 = function() {
    return $.asm.getTempRet0.apply(null, arguments);
  }, $.runPostSets = function() {
    return $.asm.runPostSets.apply(null, arguments);
  }, $.setTempRet0 = function() {
    return $.asm.setTempRet0.apply(null, arguments);
  }, $.setThrew = function() {
    return $.asm.setThrew.apply(null, arguments);
  };
  var A5 = $.stackAlloc = function() {
    return $.asm.stackAlloc.apply(null, arguments);
  }, A9 = $.stackRestore = function() {
    return $.asm.stackRestore.apply(null, arguments);
  }, IA = $.stackSave = function() {
    return $.asm.stackSave.apply(null, arguments);
  };
  function II(A4) {
    this.name = "ExitStatus", this.message = "Program terminated with exit(" + A4 + ")", this.status = A4;
  }
  function Ig(A4) {
    if (A4 = A4 || $.arguments, !(A7 > 0)) (function A8() {
      if ($.preRun) for ("function" == typeof $.preRun && ($.preRun = [$.preRun]); $.preRun.length; ) Aq($.preRun.shift());
      AY(AJ);
    })(), !(A7 > 0) && ($.calledRun || ($.setStatus ? ($.setStatus("Running..."), setTimeout(function() {
      setTimeout(function() {
        $.setStatus("");
      }, 1), I2();
    }, 1)) : I2()));
    function I2() {
      !$.calledRun && ($.calledRun = true, p || (A0 || (A0 = true, AY(Af)), AY(AH), $.onRuntimeInitialized && $.onRuntimeInitialized(), (function A8() {
        if ($.postRun) for ("function" == typeof $.postRun && ($.postRun = [$.postRun]); $.postRun.length; ) Ab($.postRun.shift());
        AY(AM);
      })()));
    }
  }
  function IE(A4) {
    throw $.onAbort && $.onAbort(A4), void 0 !== A4 ? (f(A4), H(A4), A4 = JSON.stringify(A4)) : A4 = "", p = true, "abort(" + A4 + "). Build with -s ASSERTIONS=1 for more info.";
  }
  if ($.dynCall_iii = function() {
    return $.asm.dynCall_iii.apply(null, arguments);
  }, $.asm = A3, $.ccall = j, $.cwrap = function A4(I2, g2, B2, E2) {
    var Q2 = (B2 = B2 || []).every(function(A8) {
      return "number" === A8;
    });
    return "string" !== g2 && Q2 && !E2 ? T(I2) : function() {
      return j(I2, g2, B2, arguments, E2);
    };
  }, II.prototype = Error(), II.prototype.constructor = II, AW = function A4() {
    $.calledRun || Ig(), $.calledRun || (AW = A4);
  }, $.run = Ig, $.abort = IE, $.preInit) for ("function" == typeof $.preInit && ($.preInit = [$.preInit]); $.preInit.length > 0; ) $.preInit.pop()();
  $.noExitRuntime = true, Ig(), $.onRuntimeInitialized = () => {
    isReady = true, readySolver();
  }, stbvorbis.decode = function(A4) {
    return (function A8(I2) {
      if (!isReady) throw Error("SF3 decoder has not been initialized yet. Did you await synth.isReady?");
      var g2 = {};
      function B2(A10) {
        return new Int32Array($.HEAPU8.buffer, A10, 1)[0];
      }
      function E2(A10, I3) {
        var g3 = new ArrayBuffer(I3 * Float32Array.BYTES_PER_ELEMENT), B3 = new Float32Array(g3);
        return B3.set(new Float32Array($.HEAPU8.buffer, A10, I3)), B3;
      }
      g2.open = $.cwrap("stb_vorbis_js_open", "number", []), g2.close = $.cwrap("stb_vorbis_js_close", "void", ["number"]), g2.channels = $.cwrap("stb_vorbis_js_channels", "number", ["number"]), g2.sampleRate = $.cwrap("stb_vorbis_js_sample_rate", "number", ["number"]), g2.decode = $.cwrap("stb_vorbis_js_decode", "number", [
        "number",
        "number",
        "number",
        "number",
        "number"
      ]);
      var Q2, C, i, h2, o = g2.open(), G = (Q2 = I2, C = I2.byteLength, i = $._malloc(C), (h2 = new Uint8Array($.HEAPU8.buffer, i, C)).set(new Uint8Array(Q2, 0, C)), h2), D = $._malloc(4), a2 = $._malloc(4), S2 = g2.decode(o, G.byteOffset, G.byteLength, D, a2);
      if ($._free(G.byteOffset), S2 < 0) throw g2.close(o), $._free(D), Error("stbvorbis decode failed: " + S2);
      for (var F = g2.channels(o), R = Array(F), s2 = new Int32Array($.HEAPU32.buffer, B2(D), F), w2 = 0; w2 < F; w2++) R[w2] = E2(s2[w2], S2), $._free(s2[w2]);
      var y2 = g2.sampleRate(o);
      return g2.close(o), $._free(B2(D)), $._free(D), {
        data: R,
        sampleRate: y2,
        eof: true,
        error: null
      };
    })(A4);
  };
})();
var stb = stbvorbis;
var DEFAULT_SYNTH_OPTIONS = {
  effectsEnabled: true,
  maxBufferSize: 128,
  initialTime: 0,
  eventsEnabled: true
};
var KeyModifier = class {
  /**
  * The new override velocity. -1 means unchanged.
  */
  velocity = -1;
  /**
  * The MIDI patch this key uses. -1 on any property means unchanged.
  */
  patch = {
    bankLSB: -1,
    bankMSB: -1,
    isGMGSDrum: false,
    program: -1
  };
  /**
  * Linear gain override for the voice.
  */
  gain = 1;
};
var KeyModifierManager = class {
  /**
  * The velocity override mappings for MIDI keys
  * stored as [channelNumber][midiNote].
  */
  keyMappings = [];
  /**
  * Add a mapping for a MIDI key to a KeyModifier.
  * @param channel The MIDI channel number.
  * @param midiNote The MIDI note number (0-127).
  * @param mapping The KeyModifier to apply for this key.
  */
  addMapping(channel, midiNote, mapping) {
    this.keyMappings[channel] ??= [];
    this.keyMappings[channel][midiNote] = mapping;
  }
  /**
  * Delete a mapping for a MIDI key.
  * @param channel The MIDI channel number.
  * @param midiNote The MIDI note number (0-127).
  */
  deleteMapping(channel, midiNote) {
    if (this.keyMappings[channel]?.[midiNote] === void 0) return;
    this.keyMappings[channel][midiNote] = void 0;
  }
  /**
  * Clear all key mappings.
  */
  clearMappings() {
    this.keyMappings = [];
  }
  /**
  * Sets the key mappings to a new array.
  * @param mappings A 2D array where the first dimension is the channel number and the second dimension is the MIDI note number.
  */
  setMappings(mappings) {
    this.keyMappings = mappings;
  }
  /**
  * Returns the current key mappings.
  */
  getMappings() {
    return this.keyMappings;
  }
  /**
  * Gets the velocity override for a MIDI key.
  * @param channel The MIDI channel number.
  * @param midiNote The MIDI note number (0-127).
  * @returns The velocity override, or -1 if no override is set.
  */
  getVelocity(channel, midiNote) {
    return this.keyMappings[channel]?.[midiNote]?.velocity ?? -1;
  }
  /**
  * Gets the gain override for a MIDI key.
  * @param channel The MIDI channel number.
  * @param midiNote The MIDI note number (0-127).
  * @returns The gain override, or 1 if no override is set.
  */
  getGain(channel, midiNote) {
    return this.keyMappings[channel]?.[midiNote]?.gain ?? 1;
  }
  /**
  * Checks if a MIDI key has an override for the patch.
  * @param channel The MIDI channel number.
  * @param midiNote The MIDI note number (0-127).
  * @returns True if the key has an override patch, false otherwise.
  */
  hasOverridePatch(channel, midiNote) {
    const bank = this.keyMappings[channel]?.[midiNote]?.patch?.bankMSB;
    return bank !== void 0 && bank >= 0;
  }
  /**
  * Gets the patch override for a MIDI key.
  * @param channel The MIDI channel number.
  * @param midiNote The MIDI note number (0-127).
  * @returns An object containing the bank and program numbers.
  * @throws Error if no modifier is set for the key.
  */
  getPatch(channel, midiNote) {
    const modifier = this.keyMappings[channel]?.[midiNote];
    if (modifier) return modifier.patch;
    throw new Error("No modifier.");
  }
};
function applySnapshot$1(snapshot) {
  this.keyModifierManager.setMappings(snapshot.keyMappings);
  while (this.midiChannels.length < snapshot.midiChannels.length) this.createMIDIChannel(true);
  for (let i = 0; i < snapshot.midiChannels.length; i++) this.midiChannels[i].applySnapshot(snapshot.midiChannels[i]);
  for (const [key, value] of Object.entries(snapshot.reverbProcessor)) this.reverbProcessor[key] = value;
  for (const [key, value] of Object.entries(this.chorusProcessor)) this.chorusProcessor[key] = value;
  for (const [key, value] of Object.entries(this.delayProcessor)) this.delayProcessor[key] = value;
  const is = snapshot.insertionProcessor;
  this.systemExclusive(MIDIUtils.gs(64, 3, 0, [is.type >> 8, is.type & 127]));
  for (let i = 0; i < is.params.length; i++) if (is.params[i] !== 255) this.systemExclusive(MIDIUtils.gs(64, 3, 3 + i, [is.params[i]]));
  for (const [parameter, value] of Object.entries(snapshot.midiParameters)) this.setMIDIParameter(parameter, value);
  for (const [parameter, isLocked] of Object.entries(snapshot.lockedMIDIParameters)) this.lockMIDIParameter(parameter, isLocked);
  for (const [parameter, value] of Object.entries(snapshot.systemParameters)) this.setSystemParameter(parameter, value);
}
function getSynthesizerSnapshot() {
  return {
    midiParameters: { ...this.midiParameters },
    lockedMIDIParameters: { ...this.lockedMIDIParameters },
    systemParameters: { ...this.systemParameters },
    midiChannels: this.midiChannels.map((c) => c.getSnapshot()),
    keyMappings: this.keyModifierManager.getMappings(),
    reverbProcessor: this.reverbProcessor.getSnapshot(),
    chorusProcessor: this.chorusProcessor.getSnapshot(),
    delayProcessor: this.delayProcessor.getSnapshot(),
    insertionProcessor: this.getInsertionSnapshot()
  };
}
var DEFAULT_GLOBAL_SYSTEM_PARAMETERS = {
  effectsEnabled: true,
  eventsEnabled: true,
  voiceCap: 350,
  autoAllocateVoices: false,
  reverbGain: 1,
  reverbLock: false,
  chorusGain: 1,
  chorusLock: false,
  delayGain: 1,
  delayLock: false,
  insertionEffectLock: false,
  drumLock: false,
  blackMIDIMode: false,
  deviceID: -1,
  gain: 1,
  pan: 0,
  keyShift: 0,
  fineTune: 0,
  interpolationType: InterpolationTypes.hermite,
  nrpnParamLock: false,
  monophonicRetrigger: false
};
function setSystemParameterInternal$1(parameter, value) {
  if (this.systemParameters[parameter] === value) return;
  const prev = this.systemParameters[parameter];
  this.systemParameters[parameter] = value;
  for (const ch of this.midiChannels) ch.updateInternalParams();
  switch (parameter) {
    default:
      break;
    case "voiceCap": {
      const cap = Math.min(value, 1e6);
      this.systemParameters.voiceCap = cap;
      for (let i = cap; i < this.voices.length; i++) this.voices[i].isActive = false;
      if (cap > this.voices.length) {
        SpessaLog.warn(`Allocating ${cap - this.voices.length} new voices!`);
        this.allocateNewVoices(cap - this.voices.length);
      }
      break;
    }
    case "keyShift":
      if (prev !== value) this.stopAllChannels(true);
  }
}
var MIN_TIMECENT = -15e3;
var timecentLookupTable = new Float32Array(15e3 - MIN_TIMECENT + 1);
for (let i = 0; i < timecentLookupTable.length; i++) {
  const timecents = MIN_TIMECENT + i;
  timecentLookupTable[i] = Math.pow(2, timecents / 1200);
}
function timecentsToSeconds(timecents) {
  if (timecents <= -32767) return 0;
  return timecentLookupTable[timecents - MIN_TIMECENT];
}
var MIN_ABS_CENT = -2e4;
var MAX_ABS_CENT = 16500;
var absoluteCentLookupTable = new Float32Array(MAX_ABS_CENT - MIN_ABS_CENT + 1);
for (let i = 0; i < absoluteCentLookupTable.length; i++) {
  const absoluteCents = MIN_ABS_CENT + i;
  absoluteCentLookupTable[i] = 440 * Math.pow(2, (absoluteCents - 6900) / 1200);
}
function absCentsToHz(cents) {
  if (cents < MIN_ABS_CENT || cents > MAX_ABS_CENT) return 440 * Math.pow(2, (cents - 6900) / 1200);
  return absoluteCentLookupTable[cents - MIN_ABS_CENT | 0];
}
var MIN_CENTIBELS = -16600;
var CENTIBEL_LOOKUP_TABLE = new Float32Array(16e3 - MIN_CENTIBELS + 1);
for (let i = 0; i < CENTIBEL_LOOKUP_TABLE.length; i++) {
  const centibels = MIN_CENTIBELS + i;
  CENTIBEL_LOOKUP_TABLE[i] = Math.pow(10, -centibels / 200);
}
function cbAttenuationToGain(centibels) {
  return CENTIBEL_LOOKUP_TABLE[centibels - MIN_CENTIBELS | 0];
}
var FILTER_SMOOTHING_FACTOR = 0.03;
var LowpassFilter = class LowpassFilter2 {
  /**
  * For smoothing the filter cutoff frequency.
  */
  static smoothingConstant = 1;
  /**
  * Cached coefficient calculations.
  * stored as cachedCoefficients[resonanceCb + currentInitialFc * 961].
  */
  static cachedCoefficients = /* @__PURE__ */ new Map();
  /**
  * Resonance in centibels.
  */
  resonanceCb = 0;
  /**
  * Current cutoff frequency in absolute cents.
  */
  currentInitialFc = 13500;
  /**
  * Filter coefficient 1.
  */
  a0 = 0;
  /**
  * Filter coefficient 2.
  */
  a1 = 0;
  /**
  * Filter coefficient 3.
  */
  a2 = 0;
  /**
  * Filter coefficient 4.
  */
  a3 = 0;
  /**
  * Filter coefficient 5.
  */
  a4 = 0;
  /**
  * Input history 1.
  */
  x1 = 0;
  /**
  * Input history 2.
  */
  x2 = 0;
  /**
  * Output history 1.
  */
  y1 = 0;
  /**
  * Output history 2.
  */
  y2 = 0;
  /**
  * For tracking the last cutoff frequency in the apply method, absolute cents.
  * Set to infinity to force recalculation.
  */
  lastTargetCutoff = Infinity;
  /**
  * Used for tracking if the filter has been initialized.
  */
  initialized = false;
  /**
  * Filter's sample rate in Hz.
  */
  sampleRate;
  /**
  * Maximum cutoff frequency in Hz.
  * This is used to prevent aliasing and ensure the filter operates within the valid frequency range.
  */
  maxCutoff;
  /**
  * Initializes a new instance of the filter.
  * @param sampleRate the sample rate of the audio engine in Hz.
  */
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.maxCutoff = sampleRate * 0.45;
  }
  static initCache(sampleRate) {
    LowpassFilter2.smoothingConstant = FILTER_SMOOTHING_FACTOR * (44100 / sampleRate);
    const dummy = new LowpassFilter2(sampleRate);
    dummy.resonanceCb = 0;
    for (let i = 8e3; i < 13500; i++) {
      dummy.currentInitialFc = i;
      dummy.calculateCoefficients(i);
    }
  }
  init() {
    this.lastTargetCutoff = Infinity;
    this.resonanceCb = 0;
    this.currentInitialFc = 13500;
    this.a0 = 0;
    this.a1 = 0;
    this.a2 = 0;
    this.a3 = 0;
    this.a4 = 0;
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
    this.initialized = false;
  }
  /**
  * Calculates the filter coefficients based on the current resonance and cutoff frequency and caches them.
  * @param cutoffCents The cutoff frequency in cents.
  */
  calculateCoefficients(cutoffCents) {
    cutoffCents = cutoffCents | 0;
    const qCb = this.resonanceCb;
    const cached = LowpassFilter2.cachedCoefficients.get(qCb + cutoffCents * 961);
    if (cached !== void 0) {
      this.a0 = cached.a0;
      this.a1 = cached.a1;
      this.a2 = cached.a2;
      this.a3 = cached.a3;
      this.a4 = cached.a4;
      return;
    }
    let cutoffHz = absCentsToHz(cutoffCents);
    cutoffHz = Math.min(cutoffHz, this.maxCutoff);
    const resonanceGain = cbAttenuationToGain(-(qCb - 3.01));
    const qGain = 1 / Math.sqrt(cbAttenuationToGain(-qCb));
    const w = 2 * Math.PI * cutoffHz / this.sampleRate;
    const cosw = Math.cos(w);
    const alpha = Math.sin(w) / (2 * resonanceGain);
    const b1 = (1 - cosw) * qGain;
    const b0 = b1 / 2;
    const b2 = b0;
    const a0 = 1 + alpha;
    const a1 = -2 * cosw;
    const a2 = 1 - alpha;
    const toCache = {
      a0: b0 / a0,
      a1: b1 / a0,
      a2: b2 / a0,
      a3: a1 / a0,
      a4: a2 / a0
    };
    this.a0 = toCache.a0;
    this.a1 = toCache.a1;
    this.a2 = toCache.a2;
    this.a3 = toCache.a3;
    this.a4 = toCache.a4;
    LowpassFilter2.cachedCoefficients.set(qCb + cutoffCents * 961, toCache);
  }
};
var GeneratorTypes = Object.freeze({
  invalid: -1,
  startAddrsOffset: 0,
  endAddrOffset: 1,
  startloopAddrsOffset: 2,
  endloopAddrsOffset: 3,
  startAddrsCoarseOffset: 4,
  modLfoToPitch: 5,
  vibLfoToPitch: 6,
  modEnvToPitch: 7,
  initialFilterFc: 8,
  initialFilterQ: 9,
  modLfoToFilterFc: 10,
  modEnvToFilterFc: 11,
  endAddrsCoarseOffset: 12,
  modLfoToVolume: 13,
  chorusEffectsSend: 15,
  reverbEffectsSend: 16,
  pan: 17,
  delayModLFO: 21,
  freqModLFO: 22,
  delayVibLFO: 23,
  freqVibLFO: 24,
  delayModEnv: 25,
  attackModEnv: 26,
  holdModEnv: 27,
  decayModEnv: 28,
  sustainModEnv: 29,
  releaseModEnv: 30,
  keyNumToModEnvHold: 31,
  keyNumToModEnvDecay: 32,
  delayVolEnv: 33,
  attackVolEnv: 34,
  holdVolEnv: 35,
  decayVolEnv: 36,
  sustainVolEnv: 37,
  releaseVolEnv: 38,
  keyNumToVolEnvHold: 39,
  keyNumToVolEnvDecay: 40,
  instrument: 41,
  keyRange: 43,
  velRange: 44,
  startloopAddrsCoarseOffset: 45,
  keyNum: 46,
  velocity: 47,
  initialAttenuation: 48,
  endloopAddrsCoarseOffset: 50,
  coarseTune: 51,
  fineTune: 52,
  sampleID: 53,
  sampleModes: 54,
  scaleTuning: 56,
  exclusiveClass: 57,
  overridingRootKey: 58,
  endOper: 60,
  amplitude: 61,
  vibLfoRate: 62,
  vibLfoAmplitudeDepth: 63,
  vibLfoToFilterFc: 64,
  modLfoRate: 65,
  modLfoAmplitudeDepth: 66
});
var MAX_GENERATOR = Math.max(...Object.values(GeneratorTypes));
var GENERATORS_AMOUNT = MAX_GENERATOR + 1;
var GeneratorLimits = Object.freeze({
  [GeneratorTypes.invalid]: {
    min: 0,
    max: 0,
    def: 0,
    nrpn: 0
  },
  [GeneratorTypes.endOper]: {
    min: 0,
    max: 0,
    def: 0,
    nrpn: 0
  },
  [GeneratorTypes.instrument]: {
    min: 0,
    max: 0,
    def: 0,
    nrpn: 0
  },
  [GeneratorTypes.sampleID]: {
    min: 0,
    max: 0,
    def: 0,
    nrpn: 0
  },
  [GeneratorTypes.keyRange]: {
    min: 0,
    max: 0,
    def: 0,
    nrpn: 0
  },
  [GeneratorTypes.velRange]: {
    min: 0,
    max: 0,
    def: 0,
    nrpn: 0
  },
  [GeneratorTypes.startAddrsOffset]: {
    min: 0,
    max: 32768,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.endAddrOffset]: {
    min: -32768,
    max: 32768,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.startloopAddrsOffset]: {
    min: -32768,
    max: 32768,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.endloopAddrsOffset]: {
    min: -32768,
    max: 32768,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.startAddrsCoarseOffset]: {
    min: 0,
    max: 32768,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.modLfoToPitch]: {
    min: -12e3,
    max: 12e3,
    def: 0,
    nrpn: 2
  },
  [GeneratorTypes.vibLfoToPitch]: {
    min: -12e3,
    max: 12e3,
    def: 0,
    nrpn: 2
  },
  [GeneratorTypes.modEnvToPitch]: {
    min: -12e3,
    max: 12e3,
    def: 0,
    nrpn: 2
  },
  [GeneratorTypes.initialFilterFc]: {
    min: 1500,
    max: 13500,
    def: 13500,
    nrpn: 2
  },
  [GeneratorTypes.initialFilterQ]: {
    min: 0,
    max: 960,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.modLfoToFilterFc]: {
    min: -12e3,
    max: 12e3,
    def: 0,
    nrpn: 2
  },
  [GeneratorTypes.modEnvToFilterFc]: {
    min: -12e3,
    max: 12e3,
    def: 0,
    nrpn: 2
  },
  [GeneratorTypes.endAddrsCoarseOffset]: {
    min: -32768,
    max: 32768,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.modLfoToVolume]: {
    min: -960,
    max: 960,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.chorusEffectsSend]: {
    min: 0,
    max: 1e3,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.reverbEffectsSend]: {
    min: 0,
    max: 1e3,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.pan]: {
    min: -500,
    max: 500,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.delayModLFO]: {
    min: -12e3,
    max: 5e3,
    def: -12e3,
    nrpn: 2
  },
  [GeneratorTypes.freqModLFO]: {
    min: -16e3,
    max: 4500,
    def: 0,
    nrpn: 4
  },
  [GeneratorTypes.delayVibLFO]: {
    min: -12e3,
    max: 5e3,
    def: -12e3,
    nrpn: 2
  },
  [GeneratorTypes.freqVibLFO]: {
    min: -16e3,
    max: 4500,
    def: 0,
    nrpn: 4
  },
  [GeneratorTypes.delayModEnv]: {
    min: -32768,
    max: 5e3,
    def: -32768,
    nrpn: 2
  },
  [GeneratorTypes.attackModEnv]: {
    min: -32768,
    max: 8e3,
    def: -32768,
    nrpn: 2
  },
  [GeneratorTypes.holdModEnv]: {
    min: -12e3,
    max: 5e3,
    def: -12e3,
    nrpn: 2
  },
  [GeneratorTypes.decayModEnv]: {
    min: -12e3,
    max: 8e3,
    def: -12e3,
    nrpn: 2
  },
  [GeneratorTypes.sustainModEnv]: {
    min: 0,
    max: 1e3,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.releaseModEnv]: {
    min: -12e3,
    max: 8e3,
    def: -12e3,
    nrpn: 2
  },
  [GeneratorTypes.keyNumToModEnvHold]: {
    min: -1200,
    max: 1200,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.keyNumToModEnvDecay]: {
    min: -1200,
    max: 1200,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.delayVolEnv]: {
    min: -12e3,
    max: 5e3,
    def: -12e3,
    nrpn: 2
  },
  [GeneratorTypes.attackVolEnv]: {
    min: -12e3,
    max: 8e3,
    def: -12e3,
    nrpn: 2
  },
  [GeneratorTypes.holdVolEnv]: {
    min: -12e3,
    max: 5e3,
    def: -12e3,
    nrpn: 2
  },
  [GeneratorTypes.decayVolEnv]: {
    min: -12e3,
    max: 8e3,
    def: -12e3,
    nrpn: 2
  },
  [GeneratorTypes.sustainVolEnv]: {
    min: 0,
    max: 1440,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.releaseVolEnv]: {
    min: -12e3,
    max: 8e3,
    def: -12e3,
    nrpn: 2
  },
  [GeneratorTypes.keyNumToVolEnvHold]: {
    min: -1200,
    max: 1200,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.keyNumToVolEnvDecay]: {
    min: -1200,
    max: 1200,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.startloopAddrsCoarseOffset]: {
    min: -32768,
    max: 32768,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.keyNum]: {
    min: -1,
    max: 127,
    def: -1,
    nrpn: 1
  },
  [GeneratorTypes.velocity]: {
    min: -1,
    max: 127,
    def: -1,
    nrpn: 1
  },
  [GeneratorTypes.initialAttenuation]: {
    min: 0,
    max: 1440,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.endloopAddrsCoarseOffset]: {
    min: -32768,
    max: 32768,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.coarseTune]: {
    min: -120,
    max: 120,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.fineTune]: {
    min: -12700,
    max: 12700,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.scaleTuning]: {
    min: 0,
    max: 1200,
    def: 100,
    nrpn: 1
  },
  [GeneratorTypes.exclusiveClass]: {
    min: 0,
    max: 99999,
    def: 0,
    nrpn: 0
  },
  [GeneratorTypes.overridingRootKey]: {
    min: -1,
    max: 127,
    def: -1,
    nrpn: 0
  },
  [GeneratorTypes.sampleModes]: {
    min: 0,
    max: 3,
    def: 0,
    nrpn: 0
  },
  [GeneratorTypes.amplitude]: {
    min: -1e3,
    max: 1e3,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.vibLfoRate]: {
    min: -1e3,
    max: 1e3,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.vibLfoToFilterFc]: {
    min: -12e3,
    max: 12e3,
    def: 0,
    nrpn: 2
  },
  [GeneratorTypes.vibLfoAmplitudeDepth]: {
    min: 0,
    max: 1e3,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.modLfoRate]: {
    min: -1e3,
    max: 1e3,
    def: 0,
    nrpn: 1
  },
  [GeneratorTypes.modLfoAmplitudeDepth]: {
    min: 0,
    max: 1e3,
    def: 0,
    nrpn: 1
  }
});
var CB_SILENCE = 960;
var PERCEIVED_CB_SILENCE = 900;
var VolumeEnvelope = class {
  /**
  * The target gain for the current rendering block.
  */
  outputGain = 0;
  /**
  * The current attenuation of the envelope in cB.
  */
  attenuationCb = CB_SILENCE;
  /**
  * The current stage of the volume envelope.
  */
  state = 0;
  /**
  * The sample rate in Hz.
  */
  sampleRate;
  /**
  * The sample count between updates of the volume envelope.
  * Since the volume envelope calculation runs once per rendering quantum,
  * this effectively the buffer size.
  */
  updateInterval;
  /**
  * The envelope's current time in samples.
  */
  sampleTime = 0;
  /**
  * The dB attenuation of the envelope when it entered the release stage.
  */
  releaseStartCb = CB_SILENCE;
  /**
  * The time in samples relative to the start of the envelope.
  */
  releaseStartTimeSamples = 0;
  /**
  * The attack duration in samples.
  */
  attackDuration = 0;
  /**
  * The decay duration in samples.
  */
  decayDuration = 0;
  /**
  * The release duration in samples.
  */
  releaseDuration = 0;
  /**
  * The voice's sustain amount in cB.
  */
  sustainCb = 0;
  /**
  * The time in samples to the end of delay stage, relative to the start of the envelope.
  */
  delayEnd = 0;
  /**
  * The time in samples to the end of attack stage, relative to the start of the envelope.
  */
  attackEnd = 0;
  /**
  * The time in samples to the end of hold stage, relative to the start of the envelope.
  */
  holdEnd = 0;
  /**
  * The time in samples to the end of decay stage, relative to the start of the envelope.
  */
  decayEnd = 0;
  /**
  * If the volume envelope has ever entered the release phase.
  * @private
  */
  enteredRelease = false;
  /**
  * If sustain stage is silent,
  * then we can turn off the voice when it is silent.
  * We can't do that with modulated as it can silence the volume and then raise it again, and the voice must keep playing.
  */
  canEndOnSilentSustain = false;
  /**
  * @param sampleRate Hz
  * @param bufferSize samples
  */
  constructor(sampleRate, bufferSize) {
    this.sampleRate = sampleRate;
    this.updateInterval = bufferSize;
  }
  /**
  * Starts the release phase in the envelope.
  * @param voice the voice this envelope belongs to.
  */
  startRelease(voice) {
    this.releaseStartTimeSamples = this.sampleTime;
    const timecents = voice.overrideReleaseVolEnv || voice.modulatedGenerators[GeneratorTypes.releaseVolEnv];
    this.releaseDuration = this.timecentsToSamples(Math.max(-7200, timecents));
    if (this.enteredRelease) this.releaseStartCb = this.attenuationCb;
    else {
      const sustainCb = Math.max(0, Math.min(CB_SILENCE, this.sustainCb));
      const fraction = sustainCb / CB_SILENCE;
      const keyNumAddition = (60 - voice.targetKey) * voice.modulatedGenerators[GeneratorTypes.keyNumToVolEnvDecay];
      this.decayDuration = this.timecentsToSamples(voice.modulatedGenerators[GeneratorTypes.decayVolEnv] + keyNumAddition) * fraction;
      switch (this.state) {
        case 0:
          this.releaseStartCb = CB_SILENCE;
          break;
        case 1: {
          const elapsed = 1 - (this.attackEnd - this.releaseStartTimeSamples) / this.attackDuration;
          this.releaseStartCb = 200 * Math.log10(elapsed) * -1;
          break;
        }
        case 2:
          this.releaseStartCb = 0;
          break;
        case 3:
          this.releaseStartCb = (1 - (this.decayEnd - this.releaseStartTimeSamples) / this.decayDuration) * sustainCb;
          break;
        case 4:
          this.releaseStartCb = sustainCb;
          break;
      }
      this.releaseStartCb = Math.max(0, Math.min(this.releaseStartCb, CB_SILENCE));
      this.attenuationCb = this.releaseStartCb;
    }
    this.enteredRelease = true;
    const releaseFraction = (CB_SILENCE - this.releaseStartCb) / CB_SILENCE;
    this.releaseDuration *= releaseFraction;
    if (this.releaseStartCb >= PERCEIVED_CB_SILENCE) voice.isActive = false;
  }
  /**
  * Initialize the volume envelope
  * @param voice The voice this envelope belongs to
  */
  init(voice) {
    this.enteredRelease = false;
    this.state = 0;
    this.sampleTime = 0;
    this.outputGain = 0;
    this.canEndOnSilentSustain = voice.modulatedGenerators[GeneratorTypes.sustainVolEnv] >= PERCEIVED_CB_SILENCE;
    this.sustainCb = Math.min(CB_SILENCE, voice.modulatedGenerators[GeneratorTypes.sustainVolEnv]);
    this.attackDuration = this.timecentsToSamples(voice.modulatedGenerators[GeneratorTypes.attackVolEnv]);
    const keyNumAddition = (60 - voice.targetKey) * voice.modulatedGenerators[GeneratorTypes.keyNumToVolEnvDecay];
    const fraction = this.sustainCb / CB_SILENCE;
    this.decayDuration = this.timecentsToSamples(voice.modulatedGenerators[GeneratorTypes.decayVolEnv] + keyNumAddition) * fraction;
    this.delayEnd = this.timecentsToSamples(voice.modulatedGenerators[GeneratorTypes.delayVolEnv]);
    this.attackEnd = this.attackDuration + this.delayEnd;
    const holdExcursion = (60 - voice.targetKey) * voice.modulatedGenerators[GeneratorTypes.keyNumToVolEnvHold];
    this.holdEnd = this.timecentsToSamples(voice.modulatedGenerators[GeneratorTypes.holdVolEnv] + holdExcursion) + this.attackEnd;
    this.decayEnd = this.decayDuration + this.holdEnd;
    if (this.attackEnd <= this.updateInterval) this.state = 2;
  }
  /**
  * Calculates the gain value for the last sample in the block and writes it to `outputGain`.
  * Essentially we use approach of 100dB is silence, 0dB is peak.
  * @param sampleCount the amount of samples to write
  * @param gainTarget the gain to apply.
  * @returns if the voice has finished.
  */
  process(sampleCount, gainTarget) {
    const { releaseStartTimeSamples, releaseStartCb, releaseDuration, delayEnd, attackEnd, attackDuration, holdEnd, decayEnd, decayDuration, sustainCb } = this;
    const sampleTime = this.sampleTime += sampleCount;
    if (this.enteredRelease) {
      const elapsedRelease = sampleTime - releaseStartTimeSamples;
      const cbDifference = CB_SILENCE - releaseStartCb;
      this.attenuationCb = elapsedRelease / releaseDuration * cbDifference + releaseStartCb;
      this.outputGain = CENTIBEL_LOOKUP_TABLE[this.attenuationCb - MIN_CENTIBELS | 0] * gainTarget;
      return this.attenuationCb < PERCEIVED_CB_SILENCE;
    }
    switch (this.state) {
      case 0:
        if (sampleTime < delayEnd) {
          this.attenuationCb = CB_SILENCE;
          this.outputGain = 0;
          return true;
        }
        this.state++;
      case 1:
        if (sampleTime < attackEnd) {
          this.attenuationCb = 0;
          const linearGain = 1 - (attackEnd - sampleTime) / attackDuration;
          this.outputGain = linearGain * gainTarget;
          return true;
        }
        this.state++;
      case 2:
        if (sampleTime < holdEnd) {
          this.attenuationCb = 0;
          this.outputGain = gainTarget;
          return true;
        }
        this.state++;
      case 3:
        if (sampleTime < decayEnd) {
          this.attenuationCb = (1 - (decayEnd - sampleTime) / decayDuration) * sustainCb;
          this.outputGain = gainTarget * CENTIBEL_LOOKUP_TABLE[this.attenuationCb - MIN_CENTIBELS | 0];
          return true;
        }
        this.state++;
      case 4:
        if (this.canEndOnSilentSustain && sustainCb >= PERCEIVED_CB_SILENCE) {
          this.attenuationCb = CB_SILENCE;
          this.outputGain = 0;
          return false;
        }
        this.attenuationCb = sustainCb;
        this.outputGain = gainTarget * CENTIBEL_LOOKUP_TABLE[sustainCb - MIN_CENTIBELS | 0];
        return true;
    }
  }
  timecentsToSamples(tc) {
    return Math.max(0, Math.floor(timecentsToSeconds(tc) * this.sampleRate));
  }
};
var SampleTypes = {
  monoSample: 1,
  rightSample: 2,
  leftSample: 4,
  linkedSample: 8,
  romMonoSample: 32769,
  romRightSample: 32770,
  romLeftSample: 32772,
  romLinkedSample: 32776
};
var ModulatorControllerSources = {
  noController: 0,
  noteOnVelocity: 2,
  noteOnKeyNum: 3,
  polyPressure: 10,
  channelPressure: 13,
  pitchWheel: 14,
  pitchWheelRange: 16,
  link: 127
};
var ModulatorCurveTypes = {
  linear: 0,
  concave: 1,
  convex: 2,
  switch: 3
};
var MODULATOR_RESOLUTION = 16384;
var MOD_CURVE_TYPES_AMOUNT = Object.keys(ModulatorCurveTypes).length;
var concave = new Float32Array(MODULATOR_RESOLUTION + 1);
var convex = new Float32Array(MODULATOR_RESOLUTION + 1);
concave[0] = 0;
concave[concave.length - 1] = 1;
convex[0] = 0;
convex[convex.length - 1] = 1;
for (let i = 1; i < MODULATOR_RESOLUTION - 1; i++) {
  const x = -400 / 960 * Math.log(i / (concave.length - 1)) / Math.LN10;
  convex[i] = 1 - x;
  concave[concave.length - 1 - i] = x;
}
function getModulatorCurveValue(transformType, curveType, value) {
  const isBipolar = !!(transformType & 2);
  if (!!(transformType & 1)) value = 1 - value;
  switch (curveType) {
    case ModulatorCurveTypes.linear:
      if (isBipolar) return value * 2 - 1;
      return value;
    case ModulatorCurveTypes.switch:
      value = value > 0.5 ? 1 : 0;
      if (isBipolar) return value * 2 - 1;
      return value;
    case ModulatorCurveTypes.concave:
      if (isBipolar) {
        value = value * 2 - 1;
        if (value < 0) return -concave[Math.trunc(value * -MODULATOR_RESOLUTION)];
        return concave[Math.trunc(value * MODULATOR_RESOLUTION)];
      }
      return concave[Math.trunc(value * MODULATOR_RESOLUTION)];
    case ModulatorCurveTypes.convex:
      if (isBipolar) {
        value = value * 2 - 1;
        if (value < 0) return -convex[Math.trunc(value * -MODULATOR_RESOLUTION)];
        return convex[Math.trunc(value * MODULATOR_RESOLUTION)];
      }
      return convex[Math.trunc(value * MODULATOR_RESOLUTION)];
  }
}
var MODENV_PEAK = 1;
var CONVEX_ATTACK = new Float32Array(1e3);
for (let i = 0; i < CONVEX_ATTACK.length; i++) CONVEX_ATTACK[i] = getModulatorCurveValue(0, ModulatorCurveTypes.convex, i / 1e3);
var ModulationEnvelope = class {
  /**
  * The attack duration, in seconds.
  */
  attackDuration = 0;
  /**
  * The decay duration, in seconds.
  */
  decayDuration = 0;
  /**
  * The hold duration, in seconds.
  */
  holdDuration = 0;
  /**
  * Release duration, in seconds.
  */
  releaseDuration = 0;
  /**
  * The sustain level 0-1.
  */
  sustainLevel = 0;
  /**
  * Delay phase end time in seconds, absolute (audio context time).
  */
  delayEnd = 0;
  /**
  * Attack phase end time in seconds, absolute (audio context time).
  */
  attackEnd = 0;
  /**
  * Hold phase end time in seconds, absolute (audio context time).
  */
  holdEnd = 0;
  /**
  * The level of the envelope when the release phase starts.
  */
  releaseStartLevel = 0;
  /**
  * The current modulation envelope value.
  */
  currentValue = 0;
  /**
  * If the modulation envelope has ever entered the release phase.
  */
  enteredRelease = false;
  /**
  * Decay phase end time in seconds, absolute (audio context time).
  */
  decayEnd = 0;
  /**
  * Calculates the current modulation envelope value for the given time and voice.
  * @param voice the voice we are working on.
  * @param currentTime in seconds.
  * @returns  mod env value, from 0 to 1.
  */
  process(voice, currentTime) {
    if (this.enteredRelease) {
      if (this.releaseStartLevel === 0) return 0;
      return Math.max(0, (1 - (currentTime - voice.releaseStartTime) / this.releaseDuration) * this.releaseStartLevel);
    }
    if (currentTime < this.delayEnd) this.currentValue = 0;
    else if (currentTime < this.attackEnd) this.currentValue = CONVEX_ATTACK[~~((1 - (this.attackEnd - currentTime) / this.attackDuration) * 1e3)];
    else if (currentTime < this.holdEnd) this.currentValue = MODENV_PEAK;
    else if (currentTime < this.decayEnd) this.currentValue = (1 - (this.decayEnd - currentTime) / this.decayDuration) * (this.sustainLevel - MODENV_PEAK) + MODENV_PEAK;
    else this.currentValue = this.sustainLevel;
    return this.currentValue;
  }
  /**
  * Starts the release phase in the envelope.
  * @param voice the voice this envelope belongs to.
  */
  startRelease(voice) {
    this.releaseStartLevel = this.currentValue;
    this.enteredRelease = true;
    const releaseTime2 = this.tc2Sec(Math.max(voice.modulatedGenerators[GeneratorTypes.releaseModEnv], -7200));
    this.releaseDuration = releaseTime2 * this.releaseStartLevel;
  }
  /**
  * Initializes the modulation envelope.
  * @param voice the voice this envelope belongs to.
  */
  init(voice) {
    this.enteredRelease = false;
    this.sustainLevel = 1 - voice.modulatedGenerators[GeneratorTypes.sustainModEnv] / 1e3;
    this.attackDuration = this.tc2Sec(voice.modulatedGenerators[GeneratorTypes.attackModEnv]);
    const decayKeyExcursionCents = (60 - voice.targetKey) * voice.modulatedGenerators[GeneratorTypes.keyNumToModEnvDecay];
    const decayTime = this.tc2Sec(voice.modulatedGenerators[GeneratorTypes.decayModEnv] + decayKeyExcursionCents);
    this.decayDuration = decayTime * (1 - this.sustainLevel);
    const holdKeyExcursionCents = (60 - voice.targetKey) * voice.modulatedGenerators[GeneratorTypes.keyNumToModEnvHold];
    this.holdDuration = this.tc2Sec(holdKeyExcursionCents + voice.modulatedGenerators[GeneratorTypes.holdModEnv]);
    this.delayEnd = voice.startTime + this.tc2Sec(voice.modulatedGenerators[GeneratorTypes.delayModEnv]);
    this.attackEnd = this.delayEnd + this.attackDuration;
    this.holdEnd = this.attackEnd + this.holdDuration;
    this.decayEnd = this.holdEnd + this.decayDuration;
  }
  tc2Sec(timecents) {
    if (timecents <= -10114) return 0;
    return timecentsToSeconds(timecents);
  }
};
var WavetableOscillator = class {
  /**
  * Is the loop on?
  */
  isLooping = false;
  /**
  * Sample data of the voice.
  */
  sampleData;
  /**
  * Playback step (rate) for sample pitch correction.
  */
  playbackStep = 0;
  /**
  * Start position of the loop.
  * Inclusive.
  */
  loopStart = 0;
  /**
  * End position of the loop.
  * Exclusive.
  */
  loopEnd = 0;
  /**
  * Length of the loop.
  * @private
  */
  loopLength = 0;
  /**
  * End position of the sample.
  * Exclusive
  */
  end = 0;
  /**
  * The current cursor of the sample.
  */
  cursor = 0;
};
var LinearOscillator = class extends WavetableOscillator {
  process(sampleCount, tuningRatio, outputBuffer) {
    const step = tuningRatio * this.playbackStep;
    const data = this.sampleData;
    const { loopEnd, loopLength, end } = this;
    let cursor = this.cursor;
    if (this.isLooping) for (let i = 0; i < sampleCount; i++) {
      while (cursor >= loopEnd) cursor -= loopLength;
      const floor = cursor | 0;
      let ceil = floor + 1;
      if (ceil >= loopEnd) ceil -= loopLength;
      const fraction = cursor - floor;
      const upper = data[ceil];
      const lower = data[floor];
      outputBuffer[i] = lower + (upper - lower) * fraction;
      cursor += step;
    }
    else for (let i = 0; i < sampleCount; i++) {
      const floor = cursor | 0;
      const ceil = floor + 1;
      if (ceil >= end) {
        outputBuffer.fill(0, i, sampleCount);
        return false;
      }
      const fraction = cursor - floor;
      const upper = data[ceil];
      const lower = data[floor];
      outputBuffer[i] = lower + (upper - lower) * fraction;
      cursor += step;
    }
    this.cursor = cursor;
    return true;
  }
};
var NearestOscillator = class extends WavetableOscillator {
  process(sampleCount, tuningRatio, outputBuffer) {
    const step = tuningRatio * this.playbackStep;
    const sampleData = this.sampleData;
    const { loopEnd, loopLength, end } = this;
    let cursor = this.cursor;
    if (this.isLooping) for (let i = 0; i < sampleCount; i++) {
      while (cursor >= loopEnd) cursor -= loopLength;
      outputBuffer[i] = sampleData[cursor | 0];
      cursor += step;
    }
    else for (let i = 0; i < sampleCount; i++) {
      if (cursor >= end) {
        outputBuffer.fill(0, i, sampleCount);
        return false;
      }
      outputBuffer[i] = sampleData[cursor | 0];
      cursor += step;
    }
    this.cursor = cursor;
    return true;
  }
};
var HermiteOscillator = class extends WavetableOscillator {
  process(sampleCount, tuningRatio, outputBuffer) {
    const step = tuningRatio * this.playbackStep;
    const sampleData = this.sampleData;
    const { loopEnd, loopLength, end } = this;
    let cursor = this.cursor;
    if (this.isLooping) for (let i = 0; i < sampleCount; i++) {
      while (cursor >= loopEnd) cursor -= loopLength;
      const y0 = cursor | 0;
      let y1 = y0 + 1;
      let y2 = y0 + 2;
      let y3 = y0 + 3;
      const t = cursor - y0;
      if (y1 >= loopEnd) y1 -= loopLength;
      if (y2 >= loopEnd) y2 -= loopLength;
      if (y3 >= loopEnd) y3 -= loopLength;
      const xm1 = sampleData[y0];
      const x0 = sampleData[y1];
      const x1 = sampleData[y2];
      const x2 = sampleData[y3];
      const c = (x1 - xm1) * 0.5;
      const v = x0 - x1;
      const w = c + v;
      const a = w + v + (x2 - x0) * 0.5;
      const b = w + a;
      outputBuffer[i] = ((a * t - b) * t + c) * t + x0;
      cursor += step;
    }
    else for (let i = 0; i < sampleCount; i++) {
      const y0 = cursor | 0;
      const y1 = y0 + 1;
      const y2 = y0 + 2;
      const y3 = y0 + 3;
      const t = cursor - y0;
      if (y3 >= end) {
        outputBuffer.fill(0, i, sampleCount);
        return false;
      }
      const xm1 = sampleData[y0];
      const x0 = sampleData[y1];
      const x1 = sampleData[y2];
      const x2 = sampleData[y3];
      const c = (x1 - xm1) * 0.5;
      const v = x0 - x1;
      const w = c + v;
      const a = w + v + (x2 - x0) * 0.5;
      const b = w + a;
      outputBuffer[i] = ((a * t - b) * t + c) * t + x0;
      cursor += step;
    }
    this.cursor = cursor;
    return true;
  }
};
var EXCLUSIVE_CUTOFF_TIME = -2320;
var Voice = class {
  /**
  * All oscillators currently available to the voice.
  */
  oscillators = [
    new LinearOscillator(),
    new NearestOscillator(),
    new HermiteOscillator()
  ];
  /**
  * The oscillator currently used by this voice.
  */
  wavetable = this.oscillators[DEFAULT_GLOBAL_SYSTEM_PARAMETERS.interpolationType];
  /**
  * Lowpass filter applied to the voice.
  */
  filter;
  /**
  * The unmodulated (copied to) generators of the voice.
  */
  generators = new Int16Array(GENERATORS_AMOUNT);
  /**
  * The generators in real-time, affected by modulators.
  * This is used during rendering.
  */
  modulatedGenerators = new Int16Array(GENERATORS_AMOUNT);
  /**
  * The voice's modulators.
  */
  modulators = new Array();
  /**
  * The current values for the respective modulators.
  * If there are more modulators, the array must be resized.
  */
  modulatorValues = new Int16Array(64);
  /**
  * Modulation envelope.
  */
  modEnv = new ModulationEnvelope();
  /**
  * Volume envelope.
  */
  volEnv;
  /**
  * Resonance offset, it is affected by the default resonant modulator
  */
  resonanceOffset = 0;
  /**
  * Priority of the voice. Used for stealing.
  */
  priority = 0;
  /**
  * If the voice is currently active.
  * If not, it can be used.
  */
  isActive = false;
  /**
  * Indicates if the voice has rendered at least one buffer.
  * Used for exclusive class to prevent killing voices set on the same note.
  */
  hasRendered = false;
  /**
  * Indicates if the voice is in the release phase.
  */
  isInRelease = false;
  /**
  * Indicates if the voice is currently held by the sustain pedal.
  */
  isHeld = false;
  /**
  * MIDI channel number of the voice.
  */
  channel = 0;
  /**
  * Grouping voices for specific Note On messages.
  * Used for overlapping Note Ons.
  */
  noteID = 0;
  /**
  * MIDI note number of the voice.
  * Direct number from the Note On message and is
  * used for Note Off and external parameters:
  * MTS and Per note Pitch Wheel.
  */
  midiNote = 0;
  /**
  * Target key of the voice.
  * This is the effective MIDI note number,
  * used to calculate scale tuning and envelope times,
  * and can be overridden by generators.
  * It is also used
  */
  targetKey = 0;
  /**
  * MIDI Velocity of the voice.
  * This can be overridden by generators and is the effective velocity.
  * MIDI Note On velocity is only used for zone filtering.
  */
  velocity = 0;
  /**
  * The root key of the voice.
  */
  rootKey = 0;
  /**
  * The pressure of the voice
  */
  pressure = 0;
  /**
  * Linear gain of the voice. Used with Key Modifiers.
  */
  gainModifier = 1;
  /**
  * Looping mode of the sample:
  * 0 - no loop
  * 1 - loop
  * 2 - UNOFFICIAL: polyphone 2.4 added start on release
  * 3 - loop then play when released
  */
  loopingMode = 0;
  /**
  * Start time of the voice, absolute.
  */
  startTime = 0;
  /**
  * Start time of the release phase, absolute.
  */
  releaseStartTime = Infinity;
  /**
  * Current tuning in cents.
  */
  tuningCents = 0;
  /**
  * Current calculated tuning. (as in ratio)
  */
  tuningRatio = 1;
  /**
  * From -500 to 500. Used for smoothing.
  */
  currentPan = 0;
  /**
  * Initial key to glide from, MIDI Note number. If -1, the portamento is OFF.
  */
  portamentoFromKey = -1;
  /**
  * Duration of the linear glide, in seconds.
  */
  portamentoDuration = 0;
  /**
  * From -500 to 500, where zero means disabled (use the channel pan). Used for random pan.
  */
  overridePan = 0;
  /**
  * In cents.
  */
  pitchOffset = 0;
  /**
  * Reverb send of the voice, used for drum parts, otherwise 1.
  */
  reverbSend = 1;
  /**
  * Chorus send of the voice, used for drum parts, otherwise 1.
  */
  chorusSend = 1;
  /**
  * Delay send of the voice, used for drum parts, otherwise 1.
  */
  delaySend = 1;
  /**
  * Exclusive class number for hi-hats etc.
  */
  exclusiveClass = 0;
  /**
  * In timecents, where zero means disabled (use the modulatedGenerators table).
  * Used for exclusive notes and killing notes.
  */
  overrideReleaseVolEnv = 0;
  vibLfoPhase = 0;
  vibLfoStartTime = 0;
  modLfoPhase = 0;
  modLfoStartTime = 0;
  constructor(sampleRate, bufferSize) {
    this.volEnv = new VolumeEnvelope(sampleRate, bufferSize);
    this.filter = new LowpassFilter(sampleRate);
  }
  /**
  * Releases the voice as exclusiveClass.
  */
  exclusiveRelease(currentTime, minExclusiveLength = MIN_EXCLUSIVE_LENGTH) {
    this.overrideReleaseVolEnv = EXCLUSIVE_CUTOFF_TIME;
    this.isInRelease = false;
    this.releaseVoice(currentTime, minExclusiveLength);
  }
  /**
  * Stops the voice
  * @param currentTime
  * @param minNoteLength minimum note length in seconds
  */
  releaseVoice(currentTime, minNoteLength = MIN_NOTE_LENGTH) {
    this.releaseStartTime = currentTime;
    if (this.releaseStartTime - this.startTime < minNoteLength) this.releaseStartTime = this.startTime + minNoteLength;
  }
  setup(currentTime, channel, midiNote, noteID) {
    this.isActive = true;
    this.isInRelease = false;
    this.hasRendered = false;
    this.isHeld = false;
    this.releaseStartTime = Infinity;
    this.pressure = 0;
    this.overrideReleaseVolEnv = 0;
    this.portamentoDuration = 0;
    this.portamentoFromKey = -1;
    this.vibLfoPhase = 0.25;
    this.modLfoPhase = 0.25;
    this.startTime = currentTime;
    this.channel = channel;
    this.midiNote = midiNote;
    this.noteID = noteID;
  }
};
function bitMaskToBool(num, bit) {
  return (num >> bit & 1) > 0;
}
function toNumericBool(bool) {
  return bool ? 1 : 0;
}
var ModulatorSource = class ModulatorSource2 {
  /**
  * If this field is set to false, the controller should be mapped with a minimum value of 0 and a maximum value of 1. This is also
  * called Unipolar. Thus, it behaves similar to the Modulation Wheel controller of the MIDI specification.
  *
  * If this field is set to true, the controller should be mapped with a minimum value of -1 and a maximum value of 1. This is also
  * called Bipolar. Thus, it behaves similar to the Pitch Wheel controller of the MIDI specification.
  */
  isBipolar;
  /**
  * If this field is set true, the direction of the controller should be from the maximum value to the minimum value. So, for
  * example, if the controller source is Key Number, then a Key Number value of 0 corresponds to the maximum possible
  * controller output, and the Key Number value of 127 corresponds to the minimum possible controller input.
  */
  isNegative;
  /**
  * The index of the source.
  * It can point to one of the MIDI controllers or one of the predefined sources, depending on the 'isCC' flag.
  */
  index;
  /**
  * If this field is set to true, the MIDI Controller Palette is selected. The ‘index’ field value corresponds to one of the 128
  * MIDI Continuous Controller messages as defined in the MIDI specification.
  */
  isCC;
  /**
  * This field specifies how the minimum value approaches the maximum value.
  */
  curveType;
  /**
  * @internal
  * @param index
  * @param curveType
  * @param isCC
  * @param isBipolar
  * @param isNegative
  */
  constructor(index = ModulatorControllerSources.noController, curveType = ModulatorCurveTypes.linear, isCC = false, isBipolar = false, isNegative = false) {
    this.isBipolar = isBipolar;
    this.isNegative = isNegative;
    this.index = index;
    this.isCC = isCC;
    this.curveType = curveType;
  }
  get sourceName() {
    return this.isCC ? Object.keys(MIDIControllers).find((k) => MIDIControllers[k] === this.index) ?? this.index.toString() : Object.keys(ModulatorControllerSources).find((k) => ModulatorControllerSources[k] === this.index) ?? this.index.toString();
  }
  get curveTypeName() {
    return Object.keys(ModulatorCurveTypes).find((k) => ModulatorCurveTypes[k] === this.curveType) ?? this.curveType.toString();
  }
  static fromSourceEnum(sourceEnum) {
    const isBipolar = bitMaskToBool(sourceEnum, 9);
    const isNegative = bitMaskToBool(sourceEnum, 8);
    const isCC = bitMaskToBool(sourceEnum, 7);
    return new ModulatorSource2(sourceEnum & 127, sourceEnum >> 10 & 3, isCC, isBipolar, isNegative);
  }
  /**
  * Copies the modulator source.
  * @param source The source to copy from.
  * @returns the copied source.
  */
  static copyFrom(source) {
    return new ModulatorSource2(source.index, source.curveType, source.isCC, source.isBipolar, source.isNegative);
  }
  toString() {
    return `${this.sourceName} ${this.curveTypeName} ${this.isBipolar ? "bipolar" : "unipolar"} ${this.isNegative ? "negative" : "positive"}`;
  }
  toSourceEnum() {
    return this.curveType << 10 | toNumericBool(this.isBipolar) << 9 | toNumericBool(this.isNegative) << 8 | toNumericBool(this.isCC) << 7 | this.index;
  }
  isIdentical(source) {
    return this.index === source.index && this.isNegative === source.isNegative && this.isCC === source.isCC && this.isBipolar === source.isBipolar && this.curveType === source.curveType;
  }
  /**
  * Gets the current value from this source.
  * @param channel the MIDI channel to compute for.
  * @param pitchWheel the pitch wheel value, as channel determines if it's a per-note or a global value.
  * @param voice The voice to get the data for.
  */
  getValue(channel, pitchWheel, voice) {
    let rawValue;
    if (this.isCC) rawValue = channel.midiControllers[this.index];
    else switch (this.index) {
      default:
      case ModulatorControllerSources.noController:
        rawValue = 16383;
        break;
      case ModulatorControllerSources.noteOnVelocity:
        rawValue = voice.velocity << 7;
        break;
      case ModulatorControllerSources.noteOnKeyNum:
        rawValue = voice.targetKey << 7;
        break;
      case ModulatorControllerSources.polyPressure:
        rawValue = voice.pressure << 7;
        break;
      case ModulatorControllerSources.channelPressure:
        rawValue = channel.midiParameters.pressure << 7;
        break;
      case ModulatorControllerSources.pitchWheel:
        rawValue = pitchWheel;
        break;
      case ModulatorControllerSources.pitchWheelRange:
        rawValue = Math.floor(channel.midiParameters.pitchWheelRange * 128);
    }
    const transformType = (this.isBipolar ? 2 : 0) | (this.isNegative ? 1 : 0);
    return MODULATOR_TRANSFORMS[MODULATOR_RESOLUTION * (this.curveType * MOD_CURVE_TYPES_AMOUNT + transformType) + rawValue];
  }
};
var MODULATOR_TRANSFORMS = new Float32Array(MODULATOR_RESOLUTION * 4 * MOD_CURVE_TYPES_AMOUNT);
for (let curveType = 0; curveType < MOD_CURVE_TYPES_AMOUNT; curveType++) for (let transformType = 0; transformType < 4; transformType++) {
  const tableIndex = MODULATOR_RESOLUTION * (curveType * MOD_CURVE_TYPES_AMOUNT + transformType);
  for (let value = 0; value < MODULATOR_RESOLUTION; value++) MODULATOR_TRANSFORMS[tableIndex + value] = getModulatorCurveValue(transformType, curveType, value / MODULATOR_RESOLUTION);
}
function getModSourceEnum(curveType, isBipolar, isNegative, isCC, index) {
  return new ModulatorSource(index, curveType, isCC, isBipolar, isNegative).toSourceEnum();
}
var DEFAULT_RESONANT_MOD_SOURCE = getModSourceEnum(ModulatorCurveTypes.linear, true, false, true, MIDIControllers.filterResonance);
var Modulator = class Modulator2 {
  /**
  * The generator destination of this modulator.
  */
  destination = GeneratorTypes.initialAttenuation;
  /**
  * The transform amount for this modulator.
  */
  transformAmount = 0;
  /**
  * The transform type for this modulator.
  */
  transformType = 0;
  /**
  * The primary source of this modulator.
  */
  primarySource;
  /**
  * The secondary source of this modulator.
  */
  secondarySource;
  /**
  * Creates a new SF2 Modulator
  */
  constructor(primarySource = new ModulatorSource(), secondarySource = new ModulatorSource(), destination = GeneratorTypes.invalid, amount = 0, transformType = 0) {
    this.primarySource = primarySource;
    this.secondarySource = secondarySource;
    this.destination = destination;
    this.transformAmount = amount;
    this.transformType = transformType;
  }
  get destinationName() {
    return Object.keys(GeneratorTypes).find((k) => GeneratorTypes[k] === this.destination);
  }
  /**
  * Checks if the pair of modulators is identical (in SF2 terms)
  * @param mod1 modulator 1
  * @param mod2 modulator 2
  * @param checkAmount if the amount should be checked too.
  * @returns if they are identical
  */
  static isIdentical(mod1, mod2, checkAmount = false) {
    return mod1.primarySource.isIdentical(mod2.primarySource) && mod1.secondarySource.isIdentical(mod2.secondarySource) && mod1.destination === mod2.destination && mod1.transformType === mod2.transformType && (!checkAmount || mod1.transformAmount === mod2.transformAmount);
  }
  /**
  * Copies a modulator.
  * @param mod The modulator to copy.
  * @returns The copied modulator.
  */
  static copyFrom(mod) {
    return new Modulator2(ModulatorSource.copyFrom(mod.primarySource), ModulatorSource.copyFrom(mod.secondarySource), mod.destination, mod.transformAmount, mod.transformType);
  }
  toString() {
    return `Source: ${this.primarySource.toString()}
Secondary source: ${this.secondarySource.toString()}
to: ${this.destinationName}
amount: ${this.transformAmount}` + (this.transformType === 2 ? "absolute value" : "");
  }
  write(modData, indexes) {
    writeWord(modData, this.primarySource.toSourceEnum());
    writeWord(modData, this.destination);
    writeWord(modData, this.transformAmount);
    writeWord(modData, this.secondarySource.toSourceEnum());
    writeWord(modData, this.transformType);
    if (!indexes) return;
    indexes.mod++;
  }
  /**
  * Sums transform and create a NEW modulator
  * @param modulator the modulator to sum with
  * @returns the new modulator
  */
  sumTransform(modulator) {
    const m = Modulator2.copyFrom(this);
    m.transformAmount += modulator.transformAmount;
    return m;
  }
};
var DecodedModulator = class extends Modulator {
  /**
  * Reads an SF2 modulator
  * @param sourceEnum SF2 source enum
  * @param secondarySourceEnum SF2 secondary source enum
  * @param destination destination
  * @param amount amount
  * @param transformType transform type
  */
  constructor(sourceEnum, secondarySourceEnum, destination, amount, transformType) {
    super(ModulatorSource.fromSourceEnum(sourceEnum), ModulatorSource.fromSourceEnum(secondarySourceEnum), destination, amount, transformType);
    if (this.destination > MAX_GENERATOR) this.destination = GeneratorTypes.invalid;
  }
};
var defaultSoundFont2Modulators = [
  new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.concave, false, true, false, ModulatorControllerSources.noteOnVelocity), 0, GeneratorTypes.initialAttenuation, 960, 0),
  new DecodedModulator(129, 0, GeneratorTypes.vibLfoToPitch, 50, 0),
  new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.concave, false, true, true, MIDIControllers.mainVolume), 0, GeneratorTypes.initialAttenuation, 960, 0),
  new DecodedModulator(13, 0, GeneratorTypes.vibLfoToPitch, 50, 0),
  new DecodedModulator(526, 16, GeneratorTypes.fineTune, 12700, 0),
  new DecodedModulator(650, 0, GeneratorTypes.pan, 500, 0),
  new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.concave, false, true, true, MIDIControllers.expression), 0, GeneratorTypes.initialAttenuation, 960, 0),
  new DecodedModulator(219, 0, GeneratorTypes.reverbEffectsSend, 200, 0),
  new DecodedModulator(221, 0, GeneratorTypes.chorusEffectsSend, 200, 0)
];
var defaultSpessaSynthModulators = [
  new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.convex, true, false, true, MIDIControllers.attackTime), 0, GeneratorTypes.attackVolEnv, 6e3, 0),
  new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.linear, true, false, true, MIDIControllers.releaseTime), 0, GeneratorTypes.releaseVolEnv, 3600, 0),
  new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.linear, true, false, true, MIDIControllers.decayTime), 0, GeneratorTypes.decayVolEnv, 3600, 0),
  new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.linear, true, false, true, MIDIControllers.brightness), 0, GeneratorTypes.initialFilterFc, 9600, 0),
  new DecodedModulator(DEFAULT_RESONANT_MOD_SOURCE, 0, GeneratorTypes.initialFilterQ, 250, 0),
  new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.switch, false, false, true, MIDIControllers.softPedal), 0, GeneratorTypes.initialAttenuation, 50, 0),
  new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.switch, false, false, true, MIDIControllers.softPedal), 0, GeneratorTypes.initialFilterFc, -2400, 0),
  new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.linear, true, false, true, MIDIControllers.balance), 0, GeneratorTypes.pan, 500, 0)
];
var SPESSASYNTH_DEFAULT_MODULATORS = [...defaultSoundFont2Modulators, ...defaultSpessaSynthModulators];
var Generator = class {
  /**
  * The generator's SF2 type.
  */
  type;
  /**
  * The generator's 16-bit value.
  */
  value = 0;
  /**
  * Constructs a new generator
  * @param type generator type
  * @param value generator value
  * @param validate if the limits should be validated and clamped.
  */
  constructor(type, value, validate = true) {
    this.type = type;
    if (value === void 0) throw new Error("No value provided.");
    this.value = Math.round(value);
    if (validate) {
      const lim = GeneratorLimits[type];
      if (lim !== void 0) this.value = Math.max(lim.min, Math.min(lim.max, this.value));
    }
  }
  write(genData) {
    writeWord(genData, this.type);
    writeWord(genData, this.value);
  }
  toString() {
    return `${Object.keys(GeneratorTypes).find((k) => GeneratorTypes[k] === this.type)}: ${this.value}`;
  }
};
var BasicZone = class {
  /**
  * The zone's velocity range.
  * min -1 means that it is a default value
  */
  velRange = {
    min: -1,
    max: 127
  };
  /**
  * The zone's key range.
  * min -1 means that it is a default value.
  */
  keyRange = {
    min: -1,
    max: 127
  };
  /**
  * The zone's generators.
  */
  generators = [];
  /**
  * The zone's modulators.
  */
  modulators = [];
  get hasKeyRange() {
    return this.keyRange.min !== -1;
  }
  get hasVelRange() {
    return this.velRange.min !== -1;
  }
  /**
  * The current tuning in cents, taking in both coarse and fine generators.
  */
  get fineTuning() {
    const currentCoarse = this.getGenerator(GeneratorTypes.coarseTune, 0);
    const currentFine = this.getGenerator(GeneratorTypes.fineTune, 0);
    return currentCoarse * 100 + currentFine;
  }
  /**
  * The current tuning in cents, taking in both coarse and fine generators.
  */
  set fineTuning(tuningCents) {
    const coarse = Math.trunc(tuningCents / 100);
    const fine = tuningCents % 100;
    this.setGenerator(GeneratorTypes.coarseTune, coarse);
    this.setGenerator(GeneratorTypes.fineTune, fine);
  }
  /**
  * Adds to a given generator, or its default value.
  * @param type the generator type.
  * @param value the value to add.
  * @param validate if the value should be clamped to allowed limits.
  */
  addToGenerator(type, value, validate = true) {
    const genValue = this.getGenerator(type, GeneratorLimits[type].def);
    this.setGenerator(type, value + genValue, validate);
  }
  /**
  * Sets a generator to a given value if preset, otherwise adds a new one.
  * @param type the generator type.
  * @param value the value to set. Set to null to remove this generator (set as "unset").
  * @param validate if the value should be clamped to allowed limits.
  */
  setGenerator(type, value, validate = true) {
    switch (type) {
      case GeneratorTypes.sampleID:
        throw new Error("Use setSample()");
      case GeneratorTypes.instrument:
        throw new Error("Use setInstrument()");
      case GeneratorTypes.velRange:
      case GeneratorTypes.keyRange:
        throw new Error("Set the range manually");
    }
    if (value === null) {
      this.generators = this.generators.filter((g) => g.type !== type);
      return;
    }
    const index = this.generators.findIndex((g) => g.type === type);
    if (index === -1) this.addGenerators(new Generator(type, value, validate));
    else this.generators[index] = new Generator(type, value, validate);
  }
  /**
  * Adds generators to the zone.
  * @param generators the generators to add.
  */
  addGenerators(...generators) {
    for (const g of generators) switch (g.type) {
      default:
        this.generators.push(g);
        break;
      case GeneratorTypes.sampleID:
      case GeneratorTypes.instrument:
        break;
      case GeneratorTypes.velRange:
        this.velRange.min = g.value & 127;
        this.velRange.max = g.value >> 8 & 127;
        break;
      case GeneratorTypes.keyRange:
        this.keyRange.min = g.value & 127;
        this.keyRange.max = g.value >> 8 & 127;
    }
  }
  /**
  * Adds modulators to the zone.
  * @param modulators the modulators to add.
  */
  addModulators(...modulators) {
    this.modulators.push(...modulators);
  }
  /**
  * Gets a generator value.
  * @param generatorType the generator type.
  * @param notFoundValue if the generator is not found, this value is returned. A default value can be passed here, or null for example,
  * to check if the generator is set.
  */
  getGenerator(generatorType, notFoundValue) {
    return this.generators.find((g) => g.type === generatorType)?.value ?? notFoundValue;
  }
  copyFrom(zone) {
    this.generators = zone.generators.map((g) => new Generator(g.type, g.value, false));
    this.modulators = zone.modulators.map(Modulator.copyFrom.bind(Modulator));
    this.velRange = { ...zone.velRange };
    this.keyRange = { ...zone.keyRange };
  }
  /**
  * Filters the generators and prepends the range generators.
  */
  getWriteGenerators(bank) {
    const generators = this.generators.filter((g) => g.type !== GeneratorTypes.sampleID && g.type !== GeneratorTypes.instrument && g.type !== GeneratorTypes.keyRange && g.type !== GeneratorTypes.velRange);
    if (!bank) throw new Error("No bank provided! ");
    if (this.hasVelRange) generators.unshift(new Generator(GeneratorTypes.velRange, this.velRange.max << 8 | Math.max(this.velRange.min, 0), false));
    if (this.hasKeyRange) generators.unshift(new Generator(GeneratorTypes.keyRange, this.keyRange.max << 8 | Math.max(this.keyRange.min, 0), false));
    return generators;
  }
};
var RESAMPLE_RATE = 48e3;
var BasicSample = class {
  /**
  * The sample's name.
  */
  name;
  /**
  * Sample rate in Hz.
  */
  sampleRate;
  /**
  * Original pitch of the sample as a MIDI note number.
  */
  originalKey;
  /**
  * Pitch correction, in cents. Can be negative.
  */
  pitchCorrection;
  /**
  * Linked sample, unused if mono.
  */
  linkedSample;
  /**
  * The type of the sample.
  */
  sampleType;
  /**
  * The sample's loop start index, inclusive.
  * In sample data points, relative to the start of the sample.
  *
  * Minimum allowed value is 0.
  */
  loopStart;
  /**
  * The sample's loop end index, exclusive.
  * In sample data points, relative to the start of the sample.
  *
  * Maximum allowed value is the sample data length.
  */
  loopEnd;
  /**
  * Sample's linked instruments (the instruments that use it)
  * note that duplicates are allowed since one instrument can use the same sample multiple times.
  */
  linkedTo = [];
  /**
  * Indicates if the data was overridden, so it cannot be copied back unchanged.
  */
  dataOverridden = true;
  /**
  * The compressed sample data if the sample has been compressed.
  */
  compressedData;
  /**
  * The sample's audio data.
  */
  audioData;
  /**
  * The basic representation of a sample.
  * @param sampleName The sample's name.
  * @param sampleRate The sample's rate in Hz.
  * @param originalKey The sample's pitch as a MIDI note number.
  * @param pitchCorrection The sample's pitch correction in cents.
  * @param sampleType The sample's type, an enum that can indicate SF3.
  * @param loopStart The sample's loop start relative to the sample start in sample points.
  * @param loopEnd The sample's loop end relative to the sample start in sample points. Inclusive.
  */
  constructor(sampleName, sampleRate, originalKey, pitchCorrection, sampleType, loopStart, loopEnd) {
    this.name = sampleName;
    this.sampleRate = sampleRate;
    this.originalKey = originalKey;
    this.pitchCorrection = pitchCorrection;
    this.loopStart = loopStart;
    this.loopEnd = loopEnd;
    this.sampleType = sampleType;
  }
  /**
  * Indicates if the sample is compressed using vorbis SF3.
  */
  get isCompressed() {
    return this.compressedData !== void 0;
  }
  /**
  * If the sample is linked to another sample.
  */
  get isLinked() {
    return this.sampleType === SampleTypes.rightSample || this.sampleType === SampleTypes.leftSample || this.sampleType === SampleTypes.linkedSample;
  }
  /**
  * The sample's use count
  */
  get useCount() {
    return this.linkedTo.length;
  }
  /**
  * Get raw data for writing the file, either a compressed bit stream or signed 16-bit little endian PCM data.
  * @param allowVorbis if vorbis file data is allowed.
  * @return either s16le or vorbis data.
  */
  getRawData(allowVorbis) {
    if (this.compressedData && allowVorbis && !this.dataOverridden) return this.compressedData;
    return this.encodeS16LE();
  }
  /**
  * Resamples the audio data to a given sample rate.
  */
  resampleData(newSampleRate) {
    let audioData = this.getAudioData();
    const ratio = newSampleRate / this.sampleRate;
    const resampled = new Float32Array(Math.floor(audioData.length * ratio));
    for (let i = 0; i < resampled.length; i++) resampled[i] = audioData[Math.floor(i * (1 / ratio))];
    audioData = resampled;
    this.sampleRate = newSampleRate;
    this.loopStart = Math.floor(this.loopStart * ratio);
    this.loopEnd = Math.floor(this.loopEnd * ratio);
    this.audioData = audioData;
  }
  /**
  * Compresses the audio data
  * @param encodeVorbis the compression function to use when compressing
  */
  async compressSample(encodeVorbis) {
    if (this.isCompressed) return;
    try {
      let audioData = this.getAudioData();
      if (this.sampleRate < 8e3 || this.sampleRate > 96e3) {
        this.resampleData(RESAMPLE_RATE);
        audioData = this.getAudioData();
      }
      const compressed = await encodeVorbis(audioData, this.sampleRate);
      this.setCompressedData(compressed);
    } catch (error) {
      SpessaLog.warn(`Failed to compress ${this.name}. Leaving as uncompressed!`, error);
      this.compressedData = void 0;
    }
  }
  /**
  * Sets the sample type and unlinks if needed.
  * @param type The type to set it to.
  */
  setSampleType(type) {
    this.sampleType = type;
    if (!this.isLinked) {
      if (this.linkedSample) {
        this.linkedSample.linkedSample = void 0;
        this.linkedSample.sampleType = type;
      }
      this.linkedSample = void 0;
    }
    if ((type & 32768) > 0) throw new Error("ROM samples are not supported.");
  }
  /**
  * Unlinks the sample from its stereo link if it has any.
  */
  unlinkSample() {
    this.setSampleType(SampleTypes.monoSample);
  }
  /**
  * Links a stereo sample.
  * @param sample the sample to link to.
  * @param type either left, right or linked.
  */
  setLinkedSample(sample, type) {
    if (sample.linkedSample) throw new Error(`${sample.name} is linked tp ${sample.linkedSample.name}. Unlink it first.`);
    this.linkedSample = sample;
    sample.linkedSample = this;
    switch (type) {
      case SampleTypes.leftSample:
        this.setSampleType(SampleTypes.leftSample);
        sample.setSampleType(SampleTypes.rightSample);
        break;
      case SampleTypes.rightSample:
        this.setSampleType(SampleTypes.rightSample);
        sample.setSampleType(SampleTypes.leftSample);
        break;
      case SampleTypes.linkedSample:
        this.setSampleType(SampleTypes.linkedSample);
        sample.setSampleType(SampleTypes.linkedSample);
        break;
      default:
        throw new Error("Invalid sample type: " + type);
    }
  }
  /**
  * Links the sample to a given instrument
  * @param instrument the instrument to link to
  */
  linkTo(instrument) {
    this.linkedTo.push(instrument);
  }
  /**
  * Unlinks the sample from a given instrument
  * @param instrument the instrument to unlink from
  */
  unlinkFrom(instrument) {
    const index = this.linkedTo.indexOf(instrument);
    if (index === -1) {
      SpessaLog.warn(`Cannot unlink ${instrument.name} from ${this.name}: not linked.`);
      return;
    }
    this.linkedTo.splice(index, 1);
  }
  /**
  * Get the float32 audio data.
  * Note that this either decodes the compressed data or passes the ready sampleData.
  * If neither are set then it will throw an error!
  * @returns the audio data
  */
  getAudioData() {
    if (this.audioData) return this.audioData;
    if (this.isCompressed) {
      this.audioData = this.decodeVorbis();
      return this.audioData;
    }
    throw new Error("Sample data is undefined for a BasicSample instance.");
  }
  /**
  * Replaces the audio data *in-place*.
  * @param audioData The new audio data as Float32.
  * @param sampleRate The new sample rate, in Hertz.
  */
  setAudioData(audioData, sampleRate) {
    this.audioData = audioData;
    this.sampleRate = sampleRate;
    this.dataOverridden = true;
    this.compressedData = void 0;
  }
  /**
  * Replaces the audio with a compressed data sample and flags the sample as compressed
  * @param data the new compressed data
  */
  setCompressedData(data) {
    this.audioData = void 0;
    this.compressedData = data;
    this.dataOverridden = false;
  }
  /**
  * Encodes s16le sample
  * @return the encoded data
  */
  encodeS16LE() {
    const data = this.getAudioData();
    const data16 = new Int16Array(data.length);
    const len = data.length;
    for (let i = 0; i < len; i++) {
      let sample = data[i] * 32768;
      if (sample > 32767) sample = 32767;
      else if (sample < -32768) sample = -32768;
      data16[i] = sample;
    }
    return new IndexedByteArray(data16.buffer);
  }
  /**
  * Decode binary vorbis into a float32 pcm
  */
  decodeVorbis() {
    if (this.audioData) return this.audioData;
    if (!this.compressedData) throw new Error("Compressed data is missing.");
    try {
      const decoded = stb.decode(this.compressedData).data[0];
      if (decoded === void 0) {
        SpessaLog.warn(`Error decoding sample ${this.name}: Vorbis decode returned undefined.`);
        return new Float32Array(0);
      }
      for (let i = 0; i < decoded.length; i++) decoded[i] = Math.max(-1, Math.min(decoded[i], 0.999969482421875));
      return decoded;
    } catch (error) {
      SpessaLog.warn(`Error decoding sample ${this.name}: ${error}`);
      return new Float32Array(this.loopEnd + 1);
    }
  }
};
var EmptySample = class extends BasicSample {
  /**
  * A simplified class for creating samples.
  */
  constructor() {
    super("", 44100, 60, 0, SampleTypes.monoSample, 0, 0);
  }
};
var BasicInstrumentZone = class extends BasicZone {
  /**
  * The instrument this zone belongs to.
  */
  parentInstrument;
  /**
  * For tracking on the individual zone level, since multiple presets can refer to the same instrument.
  */
  useCount;
  /**
  * Creates a new instrument zone.
  * @param instrument The parent instrument.
  * @param sample The sample to use in this zone.
  */
  constructor(instrument, sample) {
    super();
    this.parentInstrument = instrument;
    this._sample = sample;
    sample.linkTo(this.parentInstrument);
    this.useCount = instrument.useCount;
  }
  /**
  * Zone's sample.
  */
  _sample;
  /**
  * Zone's sample.
  */
  get sample() {
    return this._sample;
  }
  /**
  * Sets a sample for this zone.
  * @param sample the sample to set.
  */
  set sample(sample) {
    if (this._sample) this._sample.unlinkFrom(this.parentInstrument);
    this._sample = sample;
    sample.linkTo(this.parentInstrument);
  }
  getWriteGenerators(bank) {
    const gens = super.getWriteGenerators(bank);
    const sampleID = bank.samples.indexOf(this.sample);
    if (sampleID === -1) throw new Error(`${this.sample.name} does not exist in ${bank.soundBankInfo.name}! Cannot write sampleID generator.`);
    gens.push(new Generator(GeneratorTypes.sampleID, sampleID, false));
    return gens;
  }
};
var BasicPresetZone = class extends BasicZone {
  /**
  * The preset this zone belongs to.
  */
  parentPreset;
  /**
  * Creates a new preset zone.
  * @param preset the preset this zone belongs to.
  * @param instrument the instrument to use in this zone.
  */
  constructor(preset, instrument) {
    super();
    this.parentPreset = preset;
    this._instrument = instrument;
    this._instrument.linkTo(this.parentPreset);
  }
  /**
  * Zone's instrument.
  */
  _instrument;
  /**
  * Zone's instrument.
  */
  get instrument() {
    return this._instrument;
  }
  /**
  * Zone's instrument.
  */
  set instrument(instrument) {
    if (this._instrument) this._instrument.unlinkFrom(this.parentPreset);
    this._instrument = instrument;
    this._instrument.linkTo(this.parentPreset);
  }
  getWriteGenerators(bank) {
    const gens = super.getWriteGenerators(bank);
    if (!bank) throw new Error("Instrument ID cannot be determined without the sound bank itself.");
    const instrumentID = bank.instruments.indexOf(this.instrument);
    if (instrumentID === -1) throw new Error(`${this.instrument.name} does not exist in ${bank.soundBankInfo.name}! Cannot write instrument generator.`);
    gens.push(new Generator(GeneratorTypes.instrument, instrumentID, false));
    return gens;
  }
};
var defaultGeneratorValues = new Int16Array(GENERATORS_AMOUNT);
for (let i = 0; i < defaultGeneratorValues.length; i++) if (GeneratorLimits[i]) defaultGeneratorValues[i] = GeneratorLimits[i].def;
var BasicPreset = class BasicPreset2 {
  /**
  * The parent soundbank instance
  * Currently used for determining default modulators and XG status
  */
  parentSoundBank;
  /**
  * The preset's name
  */
  name = "";
  program = 0;
  bankMSB = 0;
  bankLSB = 0;
  isGMGSDrum = false;
  /**
  * The preset's zones
  */
  zones = [];
  /**
  * Preset's global zone
  */
  globalZone;
  /**
  * Unused metadata
  */
  library = 0;
  /**
  * Unused metadata
  */
  genre = 0;
  /**
  * Unused metadata
  */
  morphology = 0;
  /**
  * Creates a new preset representation.
  * @param parentSoundBank the sound bank this preset belongs to.
  * @param globalZone optional, a global zone to use.
  */
  constructor(parentSoundBank, globalZone = new BasicZone()) {
    this.parentSoundBank = parentSoundBank;
    this.globalZone = globalZone;
  }
  /**
  * Checks if this preset is a drum preset
  */
  get isDrum() {
    const xg = this.parentSoundBank.isXGBank;
    return this.isGMGSDrum || xg && BankSelectHacks.isXGDrum(this.bankMSB);
  }
  static isInRange(range, number) {
    return number >= range.min && number <= range.max;
  }
  static addUniqueModulators(main, adder) {
    for (const addedMod of adder) if (!main.some((mm) => Modulator.isIdentical(addedMod, mm))) main.push(addedMod);
  }
  static subtractRanges(r1, r2) {
    return {
      min: Math.max(r1.min, r2.min),
      max: Math.min(r1.max, r2.max)
    };
  }
  /**
  * Unlinks everything from this preset.
  */
  delete() {
    for (const z of this.zones) z.instrument?.unlinkFrom(this);
  }
  /**
  * Deletes an instrument zone from this preset.
  * @param index the zone's index to delete.
  */
  deleteZone(index) {
    this.zones[index]?.instrument?.unlinkFrom(this);
    this.zones.splice(index, 1);
  }
  /**
  * Creates a new preset zone and returns it.
  * @param instrument the instrument to use in the zone.
  */
  createZone(instrument) {
    const z = new BasicPresetZone(this, instrument);
    this.zones.push(z);
    return z;
  }
  /**
  * Preloads (loads and caches synthesis data) for a given key range.
  */
  preload(keyMin, keyMax) {
    for (let key = keyMin; key < keyMax + 1; key++) for (let velocity = 0; velocity < 128; velocity++) for (const synthesisData of this.getVoiceParameters(key, velocity)) synthesisData.sample.getAudioData();
  }
  /**
  * Checks if the bank and program numbers are the same for the given preset as this one.
  * @param preset The preset to check.
  */
  matches(preset) {
    return MIDIPatchTools.matches(this, preset);
  }
  /**
  * Returns the voice synthesis data for this preset.
  * @param midiNote the MIDI note number.
  * @param velocity the MIDI velocity.
  * @returns the returned sound data.
  */
  getVoiceParameters(midiNote, velocity) {
    const voiceParameters = new Array();
    for (const presetZone of this.zones) {
      if (!BasicPreset2.isInRange(presetZone.hasKeyRange ? presetZone.keyRange : this.globalZone.keyRange, midiNote) || !BasicPreset2.isInRange(presetZone.hasVelRange ? presetZone.velRange : this.globalZone.velRange, velocity)) continue;
      const instrument = presetZone.instrument;
      if (!instrument || instrument.zones.length === 0) continue;
      const presetGenerators = new Int16Array(GENERATORS_AMOUNT);
      for (const generator of this.globalZone.generators) presetGenerators[generator.type] = generator.value;
      for (const generator of presetZone.generators) presetGenerators[generator.type] = generator.value;
      const presetModulators = [...presetZone.modulators];
      BasicPreset2.addUniqueModulators(presetModulators, this.globalZone.modulators);
      for (const instZone of instrument.zones) {
        if (!BasicPreset2.isInRange(instZone.hasKeyRange ? instZone.keyRange : instrument.globalZone.keyRange, midiNote) || !BasicPreset2.isInRange(instZone.hasVelRange ? instZone.velRange : instrument.globalZone.velRange, velocity)) continue;
        const modulators = [...instZone.modulators];
        BasicPreset2.addUniqueModulators(modulators, instrument.globalZone.modulators);
        BasicPreset2.addUniqueModulators(modulators, this.parentSoundBank.defaultModulators);
        for (const presetMod of presetModulators) {
          const matchIndex = modulators.findIndex((m) => Modulator.isIdentical(presetMod, m));
          if (matchIndex === -1) modulators.push(presetMod);
          else modulators[matchIndex] = modulators[matchIndex].sumTransform(presetMod);
        }
        const generators = new Int16Array(defaultGeneratorValues);
        for (const generator of instrument.globalZone.generators) generators[generator.type] = generator.value;
        for (const generator of instZone.generators) generators[generator.type] = generator.value;
        for (let i = 0; i < generators.length; i++) generators[i] = Math.max(-32768, Math.min(32767, generators[i] + presetGenerators[i]));
        generators[GeneratorTypes.initialAttenuation] = Math.floor(generators[GeneratorTypes.initialAttenuation] * 0.4);
        voiceParameters.push({
          sample: instZone.sample,
          generators,
          modulators
        });
      }
    }
    return voiceParameters;
  }
  /**
  * BankMSB:bankLSB:program:isGMGSDrum
  */
  toMIDIString() {
    return MIDIPatchTools.toMIDIString(this);
  }
  toString() {
    return MIDIPatchTools.toFullMIDIString(this);
  }
  /**
  * Combines preset into an instrument, flattening the preset zones into instrument zones.
  * This is a really complex function that attempts to work around the DLS limitations of only having the instrument layer.
  * @returns The instrument containing the flattened zones. In theory, it should exactly the same as this preset.
  */
  toFlattenedInstrument() {
    const addUnique = (main, adder) => {
      main.push(...adder.filter((g) => !main.some((mg) => mg.type === g.type)));
    };
    const addUniqueMods = (main, adder) => {
      main.push(...adder.filter((m) => !main.some((mm) => Modulator.isIdentical(m, mm))));
    };
    const outputInstrument = new BasicInstrument();
    outputInstrument.name = this.name;
    const globalPresetGenerators = [];
    const globalPresetModulators = [];
    const globalPresetZone = this.globalZone;
    globalPresetGenerators.push(...globalPresetZone.generators);
    globalPresetModulators.push(...globalPresetZone.modulators);
    const globalPresetKeyRange = globalPresetZone.keyRange;
    const globalPresetVelRange = globalPresetZone.velRange;
    for (const presetZone of this.zones) {
      if (!presetZone.instrument) throw new Error("No instrument in a preset zone.");
      let presetZoneKeyRange = presetZone.keyRange;
      if (!presetZone.hasKeyRange) presetZoneKeyRange = globalPresetKeyRange;
      let presetZoneVelRange = presetZone.velRange;
      if (!presetZone.hasVelRange) presetZoneVelRange = globalPresetVelRange;
      const presetGenerators = presetZone.generators.map((g) => new Generator(g.type, g.value));
      addUnique(presetGenerators, globalPresetGenerators);
      const presetModulators = [...presetZone.modulators];
      addUniqueMods(presetModulators, globalPresetModulators);
      const instrument = presetZone.instrument;
      const iZones = instrument.zones;
      const globalInstGenerators = [];
      const globalInstModulators = [];
      const globalInstZone = instrument.globalZone;
      globalInstGenerators.push(...globalInstZone.generators);
      globalInstModulators.push(...globalInstZone.modulators);
      const globalInstKeyRange = globalInstZone.keyRange;
      const globalInstVelRange = globalInstZone.velRange;
      for (const instZone of iZones) {
        if (!instZone.sample) throw new Error("No sample in an instrument zone.");
        let instZoneKeyRange = instZone.keyRange;
        if (!instZone.hasKeyRange) instZoneKeyRange = globalInstKeyRange;
        let instZoneVelRange = instZone.velRange;
        if (!instZone.hasVelRange) instZoneVelRange = globalInstVelRange;
        instZoneKeyRange = BasicPreset2.subtractRanges(instZoneKeyRange, presetZoneKeyRange);
        instZoneVelRange = BasicPreset2.subtractRanges(instZoneVelRange, presetZoneVelRange);
        if (instZoneKeyRange.max < instZoneKeyRange.min || instZoneVelRange.max < instZoneVelRange.min) continue;
        const instGenerators = instZone.generators.map((g) => new Generator(g.type, g.value));
        addUnique(instGenerators, globalInstGenerators);
        const instModulators = [...instZone.modulators];
        addUniqueMods(instModulators, globalInstModulators);
        const finalModList = [...instModulators];
        for (const mod of presetModulators) {
          const identicalInstMod = finalModList.findIndex((m) => Modulator.isIdentical(mod, m));
          if (identicalInstMod === -1) finalModList.push(mod);
          else finalModList[identicalInstMod] = finalModList[identicalInstMod].sumTransform(mod);
        }
        let finalGenList = instGenerators.map((g) => new Generator(g.type, g.value));
        for (const gen of presetGenerators) {
          if (gen.type === GeneratorTypes.velRange || gen.type === GeneratorTypes.keyRange || gen.type === GeneratorTypes.instrument || gen.type === GeneratorTypes.endOper || gen.type === GeneratorTypes.sampleModes) continue;
          const identicalInstGen = instGenerators.findIndex((g) => g.type === gen.type);
          if (identicalInstGen === -1) {
            const newAmount = GeneratorLimits[gen.type].def + gen.value;
            finalGenList.push(new Generator(gen.type, newAmount));
          } else {
            const newAmount = finalGenList[identicalInstGen].value + gen.value;
            finalGenList[identicalInstGen] = new Generator(gen.type, newAmount);
          }
        }
        finalGenList = finalGenList.filter((g) => g.type !== GeneratorTypes.sampleID && g.type !== GeneratorTypes.keyRange && g.type !== GeneratorTypes.velRange && g.type !== GeneratorTypes.endOper && g.type !== GeneratorTypes.instrument && (!(g.type in GeneratorLimits) || g.value !== GeneratorLimits[g.type].def));
        const zone = outputInstrument.createZone(instZone.sample);
        zone.keyRange = instZoneKeyRange;
        zone.velRange = instZoneVelRange;
        if (zone.keyRange.min === 0 && zone.keyRange.max === 127) zone.keyRange.min = -1;
        if (zone.velRange.min === 0 && zone.velRange.max === 127) zone.velRange.min = -1;
        zone.addGenerators(...finalGenList);
        zone.addModulators(...finalModList);
      }
    }
    return outputInstrument;
  }
  /**
  * Writes the SF2 header
  * @param phdrData
  * @param index
  */
  write(phdrData, index) {
    SpessaLog.info(`%cWriting ${this.name}...`, ConsoleColors.info);
    writeBinaryStringIndexed(phdrData.pdta, this.name.slice(0, 20), 20);
    writeBinaryStringIndexed(phdrData.xdta, this.name.slice(20), 20);
    writeWord(phdrData.pdta, this.program);
    let wBank = this.bankMSB;
    if (this.isGMGSDrum) wBank = 128;
    else if (this.bankMSB === 0) wBank = this.bankLSB;
    writeWord(phdrData.pdta, wBank);
    phdrData.xdta.currentIndex += 4;
    writeWord(phdrData.pdta, index & 65535);
    writeWord(phdrData.xdta, index >> 16);
    writeDword(phdrData.pdta, this.library);
    writeDword(phdrData.pdta, this.genre);
    writeDword(phdrData.pdta, this.morphology);
    phdrData.xdta.currentIndex += 12;
  }
};
var notGlobalizedTypes = /* @__PURE__ */ new Set([
  GeneratorTypes.velRange,
  GeneratorTypes.keyRange,
  GeneratorTypes.instrument,
  GeneratorTypes.sampleID,
  GeneratorTypes.exclusiveClass,
  GeneratorTypes.endOper,
  GeneratorTypes.sampleModes,
  GeneratorTypes.startloopAddrsOffset,
  GeneratorTypes.startloopAddrsCoarseOffset,
  GeneratorTypes.endloopAddrsOffset,
  GeneratorTypes.endloopAddrsCoarseOffset,
  GeneratorTypes.startAddrsOffset,
  GeneratorTypes.startAddrsCoarseOffset,
  GeneratorTypes.endAddrOffset,
  GeneratorTypes.endAddrsCoarseOffset,
  GeneratorTypes.initialAttenuation,
  GeneratorTypes.fineTune,
  GeneratorTypes.coarseTune,
  GeneratorTypes.keyNumToVolEnvHold,
  GeneratorTypes.keyNumToVolEnvDecay,
  GeneratorTypes.keyNumToModEnvHold,
  GeneratorTypes.keyNumToModEnvDecay
]);
var BasicInstrument = class {
  /**
  * The instrument's name
  */
  name = "";
  /**
  * The instrument's zones
  */
  zones = [];
  /**
  * Instrument's global zone
  */
  globalZone = new BasicZone();
  /**
  * Instrument's linked presets (the presets that use it)
  * note that duplicates are allowed since one preset can use the same instrument multiple times.
  */
  linkedTo = [];
  /**
  * How many presets is this instrument used by
  */
  get useCount() {
    return this.linkedTo.length;
  }
  /**
  * Creates a new instrument zone and returns it.
  * @param sample The sample to use in the zone.
  */
  createZone(sample) {
    const zone = new BasicInstrumentZone(this, sample);
    this.zones.push(zone);
    return zone;
  }
  /**
  * Links the instrument ta a given preset
  * @param preset the preset to link to
  */
  linkTo(preset) {
    this.linkedTo.push(preset);
    for (const z of this.zones) z.useCount++;
  }
  /**
  * Unlinks the instrument from a given preset
  * @param preset the preset to unlink from
  */
  unlinkFrom(preset) {
    const index = this.linkedTo.indexOf(preset);
    if (index === -1) {
      SpessaLog.warn(`Cannot unlink ${preset.name} from ${this.name}: not linked.`);
      return;
    }
    this.linkedTo.splice(index, 1);
    for (const z of this.zones) z.useCount--;
  }
  deleteUnusedZones() {
    this.zones = this.zones.filter((z) => {
      const stays = z.useCount > 0;
      if (!stays) z.sample.unlinkFrom(this);
      return stays;
    });
  }
  delete() {
    if (this.useCount > 0) throw new Error(`Cannot delete an instrument that is used by: ${this.linkedTo.map((p) => p.name).toString()}.`);
    for (const z of this.zones) z.sample.unlinkFrom(this);
  }
  /**
  * Deletes a given instrument zone if it has no uses
  * @param index the index of the zone to delete
  * @param force ignores the use count and deletes forcibly
  * @returns if the zone has been deleted
  */
  deleteZone(index, force = false) {
    const zone = this.zones[index];
    zone.useCount -= 1;
    if (zone.useCount < 1 || force) {
      zone.sample.unlinkFrom(this);
      this.zones.splice(index, 1);
      return true;
    }
    return false;
  }
  /**
  * Globalizes the instrument *in-place.*
  * This means trying to move as many generators and modulators
  * to the global zone as possible to reduce clutter and the count of parameters.
  */
  globalize() {
    const globalZone = this.globalZone;
    for (let checkedType = 0; checkedType < 58; checkedType++) {
      if (notGlobalizedTypes.has(checkedType)) continue;
      checkedType = checkedType;
      let occurrencesForValues = {};
      const defaultForChecked = GeneratorLimits[checkedType]?.def || 0;
      occurrencesForValues[defaultForChecked] = 0;
      for (const zone of this.zones) {
        const value = zone.getGenerator(checkedType, void 0);
        if (value === void 0) occurrencesForValues[defaultForChecked]++;
        else if (occurrencesForValues[value] === void 0) occurrencesForValues[value] = 1;
        else occurrencesForValues[value]++;
        let relativeCounterpart;
        switch (checkedType) {
          default:
            continue;
          case GeneratorTypes.decayVolEnv:
            relativeCounterpart = GeneratorTypes.keyNumToVolEnvDecay;
            break;
          case GeneratorTypes.holdVolEnv:
            relativeCounterpart = GeneratorTypes.keyNumToVolEnvHold;
            break;
          case GeneratorTypes.decayModEnv:
            relativeCounterpart = GeneratorTypes.keyNumToModEnvDecay;
            break;
          case GeneratorTypes.holdModEnv:
            relativeCounterpart = GeneratorTypes.keyNumToModEnvHold;
        }
        if (zone.getGenerator(relativeCounterpart, void 0) !== void 0) {
          occurrencesForValues = {};
          break;
        }
      }
      if (Object.keys(occurrencesForValues).length > 0) {
        let valueToGlobalize = ["0", 0];
        for (const [value, count] of Object.entries(occurrencesForValues)) if (count > valueToGlobalize[1]) valueToGlobalize = [value, count];
        const targetValue = Number.parseInt(valueToGlobalize[0]);
        if (targetValue !== defaultForChecked) globalZone.setGenerator(checkedType, targetValue, false);
        for (const z of this.zones) {
          const genValue = z.getGenerator(checkedType, void 0);
          if (genValue === void 0) {
            if (targetValue !== defaultForChecked) z.setGenerator(checkedType, defaultForChecked);
          } else if (genValue === targetValue) z.setGenerator(checkedType, null);
        }
      }
    }
    const modulators = this.zones.length === 0 ? [] : this.zones[0].modulators.map((m) => Modulator.copyFrom(m));
    for (const checkedModulator of modulators) {
      let existsForAllZones = true;
      for (const zone of this.zones) {
        if (!existsForAllZones) continue;
        if (!zone.modulators.find((m) => Modulator.isIdentical(m, checkedModulator))) existsForAllZones = false;
      }
      if (existsForAllZones) {
        globalZone.addModulators(Modulator.copyFrom(checkedModulator));
        for (const zone of this.zones) {
          const modulator = zone.modulators.find((m) => Modulator.isIdentical(m, checkedModulator));
          if (!modulator) continue;
          if (modulator.transformAmount === checkedModulator.transformAmount) zone.modulators.splice(zone.modulators.indexOf(modulator), 1);
        }
      }
    }
  }
  write(instData, index) {
    SpessaLog.info(`%cWriting ${this.name}...`, ConsoleColors.info);
    writeBinaryStringIndexed(instData.pdta, this.name.slice(0, 20), 20);
    writeBinaryStringIndexed(instData.xdta, this.name.slice(20), 20);
    writeWord(instData.pdta, index & 65535);
    writeWord(instData.xdta, index >>> 16);
  }
};
function getSDTA(bank, smplStartOffsets, smplEndOffsets, progressFunction) {
  let writtenCount = 0;
  const sampleData = [];
  const sampleSize = [];
  for (const s of bank.samples) {
    const r = s.getRawData(true);
    writtenCount++;
    progressFunction?.(writtenCount / bank.samples.length);
    SpessaLog.info(`%cWrote sample %c${writtenCount}. ${s.name}%c of %c${bank.samples.length}.`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized);
    sampleData.push(r);
    sampleSize.push(r.length);
    if (!s.isCompressed) sampleData.push(new Uint8Array(92));
  }
  const smpl = RIFFChunk.getParts("smpl", sampleData);
  const sdta = RIFFChunk.getParts("sdta", smpl, true);
  let offset = 0;
  for (const [i, sample] of bank.samples.entries()) {
    const size = sampleSize[i];
    let startOffset;
    let endOffset;
    if (sample.isCompressed) {
      startOffset = offset;
      endOffset = startOffset + size;
    } else {
      startOffset = offset / 2;
      endOffset = startOffset + size / 2;
      offset += 92;
    }
    offset += size;
    smplStartOffsets.push(startOffset);
    smplEndOffsets.push(endOffset);
  }
  return sdta;
}
var SoundFontSample = class extends BasicSample {
  /**
  * Linked sample index for retrieving linked samples in sf2
  */
  linkedSampleIndex;
  /**
  * The sliced sample from the smpl chunk.
  */
  s16leData;
  startByteOffset;
  endByteOffset;
  sampleID;
  /**
  * Creates a sample
  * @param sampleName
  * @param sampleStartIndex
  * @param sampleEndIndex
  * @param sampleLoopStartIndex
  * @param sampleLoopEndIndex
  * @param sampleRate
  * @param samplePitch
  * @param samplePitchCorrection
  * @param linkedSampleIndex
  * @param sampleType
  * @param sampleDataArray
  * @param sampleIndex initial sample index when loading the sfont
  * Used for SF2Pack support
  */
  constructor(sampleName, sampleStartIndex, sampleEndIndex, sampleLoopStartIndex, sampleLoopEndIndex, sampleRate, samplePitch, samplePitchCorrection, linkedSampleIndex, sampleType, sampleDataArray, sampleIndex) {
    const compressed = (sampleType & 16) > 0;
    sampleType &= -17;
    super(sampleName, sampleRate, samplePitch, samplePitchCorrection, sampleType, sampleLoopStartIndex - sampleStartIndex / 2, sampleLoopEndIndex - sampleStartIndex / 2);
    this.dataOverridden = false;
    this.name = sampleName;
    this.startByteOffset = sampleStartIndex;
    this.endByteOffset = sampleEndIndex;
    this.sampleID = sampleIndex;
    const smplStart = sampleDataArray instanceof IndexedByteArray ? sampleDataArray.currentIndex : 0;
    if (sampleDataArray instanceof IndexedByteArray) if (compressed) {
      this.loopStart += this.startByteOffset / 2;
      this.loopEnd += this.startByteOffset / 2;
      this.setCompressedData(sampleDataArray.slice(this.startByteOffset / 2 + smplStart, this.endByteOffset / 2 + smplStart));
    } else this.s16leData = sampleDataArray.slice(smplStart + this.startByteOffset, smplStart + this.endByteOffset);
    else this.setAudioData(sampleDataArray.slice(this.startByteOffset / 2, this.endByteOffset / 2), sampleRate);
    this.linkedSampleIndex = linkedSampleIndex;
  }
  getLinkedSample(samplesArray) {
    if (this.linkedSample || !this.isLinked) return;
    const linked = samplesArray[this.linkedSampleIndex];
    if (linked) if (linked.linkedSample) {
      SpessaLog.info(`%cInvalid linked sample for ${this.name}: ${linked.name} is already linked to ${linked.linkedSample.name}`, ConsoleColors.warn);
      this.unlinkSample();
    } else this.setLinkedSample(linked, this.sampleType);
    else {
      SpessaLog.info(`%cInvalid linked sample for ${this.name}. Setting to mono.`, ConsoleColors.warn);
      this.unlinkSample();
    }
  }
  /**
  * Loads the audio data and stores it for reuse
  * @returns  The audio data
  */
  getAudioData() {
    if (this.audioData) return this.audioData;
    if (this.isCompressed) return super.getAudioData();
    if (!this.s16leData) {
      console.error(this);
      throw new Error("Unexpected lack of audio data.");
    }
    const byteLength = this.endByteOffset - this.startByteOffset;
    if (byteLength < 1) {
      SpessaLog.warn(`Invalid sample ${this.name}! Invalid length: ${byteLength}`);
      return new Float32Array(1);
    }
    const audioData = new Float32Array(byteLength / 2);
    const convertedSigned16 = new Int16Array(this.s16leData.buffer);
    const l = convertedSigned16.length;
    for (let i = 0; i < l; i++) audioData[i] = convertedSigned16[i] / 32768;
    this.audioData = audioData;
    return audioData;
  }
  getRawData(allowVorbis) {
    if (this.dataOverridden || this.compressedData) return super.getRawData(allowVorbis);
    return this.s16leData ?? new Uint8Array(0);
  }
};
function readSamples(sampleHeadersChunk, smplChunkData, linkSamples = true) {
  const samples = [];
  let index = 0;
  while (sampleHeadersChunk.data.length > sampleHeadersChunk.data.currentIndex) {
    const sample = readSample(index, sampleHeadersChunk.data, smplChunkData);
    samples.push(sample);
    index++;
  }
  samples.pop();
  if (linkSamples) for (const s of samples) s.getLinkedSample(samples);
  return samples;
}
function readSample(index, sampleHeaderData, smplArrayData) {
  const sampleName = readBinaryStringIndexed(sampleHeaderData, 20);
  const sampleStartIndex = readLittleEndianIndexed(sampleHeaderData, 4) * 2;
  const sampleEndIndex = readLittleEndianIndexed(sampleHeaderData, 4) * 2;
  const sampleLoopStartIndex = readLittleEndianIndexed(sampleHeaderData, 4);
  const sampleLoopEndIndex = readLittleEndianIndexed(sampleHeaderData, 4);
  const sampleRate = readLittleEndianIndexed(sampleHeaderData, 4);
  let samplePitch = sampleHeaderData[sampleHeaderData.currentIndex++];
  if (samplePitch > 127) samplePitch = 60;
  const samplePitchCorrection = signedInt8(sampleHeaderData[sampleHeaderData.currentIndex++]);
  const sampleLink = readLittleEndianIndexed(sampleHeaderData, 2);
  const sampleType = readLittleEndianIndexed(sampleHeaderData, 2);
  return new SoundFontSample(sampleName, sampleStartIndex, sampleEndIndex, sampleLoopStartIndex, sampleLoopEndIndex, sampleRate, samplePitch, samplePitchCorrection, sampleLink, sampleType, smplArrayData, index);
}
function getSHDR(bank, smplStartOffsets, smplEndOffsets) {
  const sampleLength = 46;
  const shdrSize = sampleLength * (bank.samples.length + 1);
  const shdrData = new IndexedByteArray(shdrSize);
  const xshdrData = new IndexedByteArray(shdrSize);
  let maxSampleLink = 0;
  for (const [index, sample] of bank.samples.entries()) {
    writeBinaryStringIndexed(shdrData, sample.name.slice(0, 20), 20);
    writeBinaryStringIndexed(xshdrData, sample.name.slice(20), 20);
    const dwStart = smplStartOffsets[index];
    writeDword(shdrData, dwStart);
    xshdrData.currentIndex += 4;
    const dwEnd = smplEndOffsets[index];
    writeDword(shdrData, dwEnd);
    xshdrData.currentIndex += 4;
    let loopStart = sample.loopStart + dwStart;
    let loopEnd = sample.loopEnd + dwStart;
    if (sample.isCompressed) {
      loopStart -= dwStart;
      loopEnd -= dwStart;
    }
    writeDword(shdrData, loopStart);
    writeDword(shdrData, loopEnd);
    writeDword(shdrData, sample.sampleRate);
    shdrData[shdrData.currentIndex++] = sample.originalKey;
    shdrData[shdrData.currentIndex++] = sample.pitchCorrection;
    xshdrData.currentIndex += 14;
    const sampleLinkIndex = sample.linkedSample ? bank.samples.indexOf(sample.linkedSample) : 0;
    writeWord(shdrData, Math.max(0, sampleLinkIndex) & 65535);
    writeWord(xshdrData, Math.max(0, sampleLinkIndex) >> 16);
    maxSampleLink = Math.max(maxSampleLink, sampleLinkIndex);
    let type = sample.sampleType;
    if (sample.isCompressed) type |= 16;
    writeWord(shdrData, type);
    xshdrData.currentIndex += 2;
  }
  writeBinaryStringIndexed(shdrData, "EOS", sampleLength);
  writeBinaryStringIndexed(xshdrData, "EOS", sampleLength);
  return {
    pdta: RIFFChunk.write("shdr", shdrData),
    xdta: RIFFChunk.write("shdr", xshdrData)
  };
}
function writeSF2Elements(bank, isPreset = false) {
  const elements = isPreset ? bank.presets : bank.instruments;
  const genHeader = isPreset ? "pgen" : "igen";
  const modHeader = isPreset ? "pmod" : "imod";
  const bagHeader = isPreset ? "pbag" : "ibag";
  const hdrHeader = isPreset ? "phdr" : "inst";
  const hdrByteSize = isPreset ? 38 : 22;
  let currentGenIndex = 0;
  const generatorIndexes = new Array();
  let currentModIndex = 0;
  const modulatorIndexes = new Array();
  const generators = new Array();
  const modulators = new Array();
  let zoneIndex = 0;
  const zoneIndexes = new Array();
  const writeZone = (z) => {
    generatorIndexes.push(currentGenIndex);
    const gens = z.getWriteGenerators(bank);
    currentGenIndex += gens.length;
    generators.push(...gens);
    modulatorIndexes.push(currentModIndex);
    const mods = z.modulators;
    currentModIndex += mods.length;
    modulators.push(...mods);
  };
  for (const el of elements) {
    zoneIndexes.push(zoneIndex);
    writeZone(el.globalZone);
    for (const zone of el.zones) writeZone(zone);
    zoneIndex += el.zones.length + 1;
  }
  generators.push(new Generator(0, 0, false));
  modulators.push(new DecodedModulator(0, 0, 0, 0, 0));
  generatorIndexes.push(currentGenIndex);
  modulatorIndexes.push(currentModIndex);
  zoneIndexes.push(zoneIndex);
  const genData = new IndexedByteArray(generators.length * 4);
  for (const g of generators) g.write(genData);
  const modData = new IndexedByteArray(modulators.length * 10);
  for (const m of modulators) m.write(modData);
  const bagSize = modulatorIndexes.length * 4;
  const bagData = {
    pdta: new IndexedByteArray(bagSize),
    xdta: new IndexedByteArray(bagSize)
  };
  for (const [i, modulatorIndex] of modulatorIndexes.entries()) {
    const generatorIndex = generatorIndexes[i];
    writeWord(bagData.pdta, generatorIndex & 65535);
    writeWord(bagData.pdta, modulatorIndex & 65535);
    writeWord(bagData.xdta, generatorIndex >> 16);
    writeWord(bagData.xdta, modulatorIndex >> 16);
  }
  const hdrSize = (elements.length + 1) * hdrByteSize;
  const hdrData = {
    pdta: new IndexedByteArray(hdrSize),
    xdta: new IndexedByteArray(hdrSize)
  };
  for (const [i, el] of elements.entries()) el.write(hdrData, zoneIndexes[i]);
  if (isPreset) {
    writeBinaryStringIndexed(hdrData.pdta, "EOP", 20);
    hdrData.pdta.currentIndex += 4;
    writeWord(hdrData.pdta, zoneIndex & 65535);
    hdrData.pdta.currentIndex += 12;
    writeBinaryStringIndexed(hdrData.xdta, "", 20);
    hdrData.xdta.currentIndex += 4;
    writeWord(hdrData.xdta, zoneIndex >> 16);
    hdrData.xdta.currentIndex += 12;
  } else {
    writeBinaryStringIndexed(hdrData.pdta, "EOI", 20);
    writeWord(hdrData.pdta, zoneIndex & 65535);
    writeBinaryStringIndexed(hdrData.xdta, "", 20);
    writeWord(hdrData.xdta, zoneIndex >> 16);
  }
  return {
    writeXdta: Math.max(currentGenIndex, currentModIndex, zoneIndex) > 65535,
    gen: {
      pdta: RIFFChunk.write(genHeader, genData),
      xdta: RIFFChunk.write(modHeader, new IndexedByteArray(4))
    },
    mod: {
      pdta: RIFFChunk.write(modHeader, modData),
      xdta: RIFFChunk.write(modHeader, new IndexedByteArray(10))
    },
    bag: {
      pdta: RIFFChunk.write(bagHeader, bagData.pdta),
      xdta: RIFFChunk.write(bagHeader, bagData.xdta)
    },
    hdr: {
      pdta: RIFFChunk.write(hdrHeader, hdrData.pdta),
      xdta: RIFFChunk.write(hdrHeader, hdrData.xdta)
    }
  };
}
var DEFAULT_SF2_WRITE_OPTIONS = {
  writeDefaultModulators: true,
  writeExtendedLimits: true,
  software: "SpessaSynth"
};
function writeSF2Internal(bank, writeOptions) {
  const options = fillWithDefaults(writeOptions, DEFAULT_SF2_WRITE_OPTIONS);
  SpessaLog.groupCollapsed("%cSaving soundbank...", ConsoleColors.info);
  SpessaLog.group("%cWriting INFO...", ConsoleColors.info);
  const infoArrays = [];
  const writeSF2Info = (type, data) => {
    if (!data) return;
    infoArrays.push(...RIFFChunk.getParts(type, [getStringBytes(data, true, true)]));
  };
  const info = bank.soundBankInfo;
  {
    const ifilData = new IndexedByteArray(4);
    writeWord(ifilData, info.version.major);
    writeWord(ifilData, info.version.minor);
    infoArrays.push(RIFFChunk.write("ifil", ifilData));
  }
  writeSF2Info("isng", info.soundEngine);
  writeSF2Info("INAM", info.name);
  writeSF2Info("irom", info.romInfo);
  if (info.romVersion) {
    const ifilData = new IndexedByteArray(4);
    writeWord(ifilData, info.romVersion.major);
    writeWord(ifilData, info.romVersion.minor);
    infoArrays.push(RIFFChunk.write("iver", ifilData));
  }
  writeSF2Info("ICRD", toISODateString(info.creationDate));
  writeSF2Info("IENG", info.engineer);
  writeSF2Info("IPRD", info.product);
  writeSF2Info("ICOP", info.copyright);
  writeSF2Info("ICMT", info?.subject ? (info?.comment ? info.comment + "\n" : "") + info.subject : info?.comment);
  const software = options.software;
  writeSF2Info("ISFT", software);
  if (bank.defaultModulators.some((mod) => !SPESSASYNTH_DEFAULT_MODULATORS.some((m) => Modulator.isIdentical(m, mod, true))) && options?.writeDefaultModulators) {
    const mods = bank.defaultModulators;
    SpessaLog.info(`%cWriting %c${mods.length}%c default modulators...`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info);
    const dmodData = new IndexedByteArray(10 + mods.length * 10);
    for (const mod of mods) mod.write(dmodData);
    writeLittleEndianIndexed(dmodData, 0, 10);
    infoArrays.push(...RIFFChunk.getParts("DMOD", [dmodData]));
  }
  SpessaLog.groupEnd();
  SpessaLog.info("%cWriting SDTA...", ConsoleColors.info);
  const smplStartOffsets = [];
  const smplEndOffsets = [];
  const sdtaChunk = getSDTA(bank, smplStartOffsets, smplEndOffsets);
  SpessaLog.info("%cWriting PDTA...", ConsoleColors.info);
  SpessaLog.info("%cWriting SHDR...", ConsoleColors.info);
  const shdrChunk = getSHDR(bank, smplStartOffsets, smplEndOffsets);
  SpessaLog.group("%cWriting instruments...", ConsoleColors.info);
  const instData = writeSF2Elements(bank, false);
  SpessaLog.groupEnd();
  SpessaLog.group("%cWriting presets...", ConsoleColors.info);
  const presData = writeSF2Elements(bank, true);
  SpessaLog.groupEnd();
  const chunks = [
    presData.hdr,
    presData.bag,
    presData.mod,
    presData.gen,
    instData.hdr,
    instData.bag,
    instData.mod,
    instData.gen,
    shdrChunk
  ];
  const pdtaChunk = RIFFChunk.getParts("pdta", chunks.map((c) => c.pdta), true);
  if (options.writeExtendedLimits && (instData.writeXdta || presData.writeXdta || bank.presets.some((p) => p.name.length > 20) || bank.instruments.some((i) => i.name.length > 20) || bank.samples.some((s) => s.name.length > 20))) {
    SpessaLog.info(`%cWriting the xdta chunk as writeExtendedLimits is enabled and at least one condition was met.`, ConsoleColors.info, ConsoleColors.value);
    infoArrays.push(...RIFFChunk.getParts("xdta", chunks.map((c) => c.xdta), true));
  }
  const infoChunk = RIFFChunk.getParts("INFO", infoArrays, true);
  SpessaLog.info("%cWriting the output file...", ConsoleColors.info);
  const main = RIFFChunk.writeParts("RIFF", [
    getStringBytes("sfbk"),
    ...infoChunk,
    ...sdtaChunk,
    ...pdtaChunk
  ]);
  SpessaLog.info(`%cSaved successfully! Final file size: %c${main.length}`, ConsoleColors.info, ConsoleColors.recognized);
  SpessaLog.groupEnd();
  return main.buffer;
}
var DLSVerifier = class {
  /**
  * @param chunk
  * @param expected
  * @throws error if the check doesn't pass
  */
  static verifyHeader(chunk, ...expected) {
    for (const expect of expected) if (chunk.header.toLowerCase() === expect.toLowerCase()) return;
    this.parsingError(`Invalid DLS chunk header! Expected "${expected.join(", or ")}" got "${chunk.header.toLowerCase()}"`);
  }
  /**
  * @param text {string}
  * @param expected {string}
  * @throws error if the check doesn't pass
  */
  static verifyText(text, ...expected) {
    for (const expect of expected) if (text.toLowerCase() === expect.toLowerCase()) return;
    this.parsingError(`FourCC error: Expected "${expected.join(", or ")}" got "${text.toLowerCase()}"`);
  }
  /**
  * @throws error if the check doesn't pass
  */
  static parsingError(error) {
    SpessaLog.groupEnd();
    throw new Error(`DLS parse error: ${error} The file may be corrupted.`);
  }
  static verifyAndReadList(chunk, ...type) {
    this.verifyHeader(chunk, "LIST");
    chunk.data.currentIndex = 0;
    this.verifyText(readBinaryStringIndexed(chunk.data, 4), ...type);
    const chunks = [];
    while (chunk.data.length > chunk.data.currentIndex) chunks.push(RIFFChunk.read(chunk.data));
    return chunks;
  }
};
var DLSSources = {
  none: 0,
  modLfo: 1,
  velocity: 2,
  keyNum: 3,
  volEnv: 4,
  modEnv: 5,
  pitchWheel: 6,
  polyPressure: 7,
  channelPressure: 8,
  vibratoLfo: 9,
  modulationWheel: 129,
  volume: 135,
  pan: 138,
  expression: 139,
  chorus: 221,
  reverb: 219,
  pitchWheelRange: 256,
  fineTune: 257,
  coarseTune: 258
};
var DLSDestinations = {
  none: 0,
  gain: 1,
  reserved: 2,
  pitch: 3,
  pan: 4,
  keyNum: 5,
  chorusSend: 128,
  reverbSend: 129,
  modLfoFreq: 260,
  modLfoDelay: 261,
  vibLfoFreq: 276,
  vibLfoDelay: 277,
  volEnvAttack: 518,
  volEnvDecay: 519,
  reservedEG1: 520,
  volEnvRelease: 521,
  volEnvSustain: 522,
  volEnvDelay: 523,
  volEnvHold: 524,
  modEnvAttack: 778,
  modEnvDecay: 779,
  reservedEG2: 780,
  modEnvRelease: 781,
  modEnvSustain: 782,
  modEnvDelay: 783,
  modEnvHold: 784,
  filterCutoff: 1280,
  filterQ: 1281
};
var DLSLoopTypes = {
  forward: 0,
  loopAndRelease: 1
};
var WSMP_SIZE = 20;
var WSMP_LOOP_SIZE = 16;
var WaveSample = class WaveSample2 extends DLSVerifier {
  /**
  * Specifies the gain to be applied to this sample in 32 bit relative gain units.
  * Each unit of gain represents 1/655360 dB.
  */
  gain = 0;
  /**
  * Specifies the MIDI note which will replay the sample at original pitch. This value ranges
  * from 0 to 127 (a value of 60 represents Middle C, as defined by the MIDI specification).
  */
  unityNote = 60;
  /**
  * Specifies the tuning offset from the usUnityNote in 16 bit relative pitch. (cents)
  */
  fineTune = 0;
  /**
  * Specifies the number (count) of <wavesample-loop> records that are contained in the
  * <wsmp-ck> chunk. The <wavesample-loop> records are stored immediately following the
  * cSampleLoops data field. One shot sounds will have the cSampleLoops field set to 0.
  * Looped sounds will have the cSampleLoops field set to 1. Values greater than 1 are not yet
  * defined at this time.
  */
  loops = new Array();
  /**
  * Specifies flag options for the digital audio sample.
  * Default to F_WSMP_NO_COMPRESSION,
  * according to all DLS files I have.
  */
  fulOptions = 2;
  static copyFrom(inputWaveSample) {
    const outputWaveSample = new WaveSample2();
    outputWaveSample.unityNote = inputWaveSample.unityNote;
    outputWaveSample.gain = inputWaveSample.gain;
    outputWaveSample.fineTune = inputWaveSample.fineTune;
    outputWaveSample.loops = inputWaveSample.loops.map((l) => {
      return { ...l };
    });
    outputWaveSample.fulOptions = inputWaveSample.fulOptions;
    return outputWaveSample;
  }
  static read(chunk) {
    this.verifyHeader(chunk, "wsmp");
    const waveSample = new WaveSample2();
    const cbSize = readLittleEndianIndexed(chunk.data, 4);
    if (cbSize !== WSMP_SIZE) SpessaLog.warn(`Wsmp cbSize mismatch: got ${cbSize}, expected ${WSMP_SIZE}.`);
    waveSample.unityNote = readLittleEndianIndexed(chunk.data, 2);
    waveSample.fineTune = signedInt16(chunk.data[chunk.data.currentIndex++], chunk.data[chunk.data.currentIndex++]);
    waveSample.gain = readLittleEndianIndexed(chunk.data, 4) | 0;
    waveSample.fulOptions = readLittleEndianIndexed(chunk.data, 4);
    if (readLittleEndianIndexed(chunk.data, 4) === 0) {
    } else {
      const cbSize2 = readLittleEndianIndexed(chunk.data, 4);
      if (cbSize2 !== WSMP_LOOP_SIZE) SpessaLog.warn(`CbSize for loop in wsmp mismatch. Expected ${WSMP_LOOP_SIZE}, got ${cbSize2}.`);
      const loopType = readLittleEndianIndexed(chunk.data, 4);
      const loopStart = readLittleEndianIndexed(chunk.data, 4);
      const loopLength = readLittleEndianIndexed(chunk.data, 4);
      waveSample.loops.push({
        loopStart,
        loopLength,
        loopType
      });
    }
    return waveSample;
  }
  static fromSFSample(sample) {
    const waveSample = new WaveSample2();
    waveSample.unityNote = sample.originalKey;
    waveSample.fineTune = sample.pitchCorrection;
    if (sample.loopEnd !== 0 || sample.loopStart !== 0) waveSample.loops.push({
      loopStart: sample.loopStart,
      loopLength: sample.loopEnd - sample.loopStart,
      loopType: DLSLoopTypes.forward
    });
    return waveSample;
  }
  static fromSFZone(zone) {
    const waveSample = new WaveSample2();
    waveSample.unityNote = zone.getGenerator(GeneratorTypes.overridingRootKey, zone.sample.originalKey);
    if (zone.getGenerator(GeneratorTypes.scaleTuning, 100) === 0 && zone.keyRange.max - zone.keyRange.min === 0) waveSample.unityNote = zone.keyRange.min;
    waveSample.fineTune = zone.fineTuning + zone.sample.pitchCorrection;
    waveSample.gain = -(zone.getGenerator(GeneratorTypes.initialAttenuation, 0) * 0.4) << 16;
    const loopingMode = zone.getGenerator(GeneratorTypes.sampleModes, 0);
    if (loopingMode !== 0) {
      const loopStart = zone.sample.loopStart + zone.getGenerator(GeneratorTypes.startloopAddrsOffset, 0) + zone.getGenerator(GeneratorTypes.startloopAddrsCoarseOffset, 0) * 32768;
      const loopEnd = zone.sample.loopEnd + zone.getGenerator(GeneratorTypes.endloopAddrsOffset, 0) + zone.getGenerator(GeneratorTypes.endloopAddrsCoarseOffset, 0) * 32768;
      let dlsLoopType;
      switch (loopingMode) {
        case 1:
        default:
          dlsLoopType = 0;
          break;
        case 3:
          dlsLoopType = 1;
      }
      waveSample.loops.push({
        loopType: dlsLoopType,
        loopStart,
        loopLength: loopEnd - loopStart
      });
    }
    return waveSample;
  }
  /**
  * Converts the wsmp data into an SF zone.
  */
  toSFZone(zone, sample) {
    let loopingMode = 0;
    const loop = this.loops[0];
    if (loop) loopingMode = loop.loopType === DLSLoopTypes.loopAndRelease ? 3 : 1;
    if (loopingMode !== 0) zone.setGenerator(GeneratorTypes.sampleModes, loopingMode);
    const wsmpAttenuationCorrected = -(this.gain >> 16) / 0.4;
    if (wsmpAttenuationCorrected !== 0) zone.setGenerator(GeneratorTypes.initialAttenuation, wsmpAttenuationCorrected);
    zone.fineTuning = this.fineTune - sample.pitchCorrection;
    if (this.unityNote !== sample.originalKey) zone.setGenerator(GeneratorTypes.overridingRootKey, this.unityNote);
    if (loop) {
      const diffStart = loop.loopStart - sample.loopStart;
      const diffEnd = loop.loopStart + loop.loopLength - sample.loopEnd;
      if (diffStart !== 0) {
        const fine = diffStart % 32768;
        zone.setGenerator(GeneratorTypes.startloopAddrsOffset, fine);
        const coarse = Math.trunc(diffStart / 32768);
        if (coarse !== 0) zone.setGenerator(GeneratorTypes.startloopAddrsCoarseOffset, coarse);
      }
      if (diffEnd !== 0) {
        const fine = diffEnd % 32768;
        zone.setGenerator(GeneratorTypes.endloopAddrsOffset, fine);
        const coarse = Math.trunc(diffEnd / 32768);
        if (coarse !== 0) zone.setGenerator(GeneratorTypes.endloopAddrsCoarseOffset, coarse);
      }
    }
  }
  write() {
    const wsmpData = new IndexedByteArray(WSMP_SIZE + this.loops.length * WSMP_LOOP_SIZE);
    writeDword(wsmpData, WSMP_SIZE);
    writeWord(wsmpData, this.unityNote);
    writeWord(wsmpData, this.fineTune);
    writeDword(wsmpData, this.gain);
    writeDword(wsmpData, this.fulOptions);
    writeDword(wsmpData, this.loops.length);
    for (const loop of this.loops) {
      writeDword(wsmpData, WSMP_LOOP_SIZE);
      writeDword(wsmpData, loop.loopType);
      writeDword(wsmpData, loop.loopStart);
      writeDword(wsmpData, loop.loopLength);
    }
    return RIFFChunk.write("wsmp", wsmpData);
  }
};
var W_FORMAT_TAG = {
  PCM: 1,
  ALAW: 6
};
function readPCM(data, bytesPerSample) {
  const maxSampleValue = Math.pow(2, bytesPerSample * 8 - 1);
  const maxUnsigned = Math.pow(2, bytesPerSample * 8);
  let normalizationFactor;
  let isUnsigned = false;
  if (bytesPerSample === 1) {
    normalizationFactor = 255;
    isUnsigned = true;
  } else normalizationFactor = maxSampleValue;
  const sampleLength = data.length / bytesPerSample;
  const sampleData = new Float32Array(sampleLength);
  if (bytesPerSample === 2) {
    const s16 = new Int16Array(data.buffer);
    const s16l = s16.length;
    for (let i = 0; i < s16l; i++) sampleData[i] = s16[i] / 32768;
  } else for (let i = 0; i < sampleData.length; i++) {
    let sample = readLittleEndianIndexed(data, bytesPerSample);
    if (isUnsigned) sampleData[i] = sample / normalizationFactor - 0.5;
    else {
      if (sample >= maxSampleValue) sample -= maxUnsigned;
      sampleData[i] = sample / normalizationFactor;
    }
  }
  return sampleData;
}
function readALAW(data, bytesPerSample) {
  const sampleLength = data.length / bytesPerSample;
  const sampleData = new Float32Array(sampleLength);
  for (let i = 0; i < sampleData.length; i++) {
    const input = readLittleEndianIndexed(data, bytesPerSample);
    let sample = input ^ 85;
    sample &= 127;
    const exponent = sample >> 4;
    let mantissa = sample & 15;
    if (exponent > 0) mantissa += 16;
    mantissa = (mantissa << 4) + 8;
    if (exponent > 1) mantissa = mantissa << exponent - 1;
    sampleData[i] = (input > 127 ? mantissa : -mantissa) / 32768;
  }
  return sampleData;
}
var DLSSample = class extends BasicSample {
  wFormatTag;
  bytesPerSample;
  /**
  * Sample's raw data before decoding it, for faster writing
  */
  rawData;
  /**
  * @param name
  * @param rate
  * @param pitch
  * @param pitchCorrection
  * @param loopStart sample data points
  * @param loopEnd sample data points
  * @param dataChunk
  * @param wFormatTag
  * @param bytesPerSample
  */
  constructor(name, rate, pitch, pitchCorrection, loopStart, loopEnd, dataChunk, wFormatTag, bytesPerSample) {
    super(name, rate, pitch, pitchCorrection, SampleTypes.monoSample, loopStart, loopEnd);
    this.dataOverridden = false;
    this.rawData = dataChunk.data;
    this.wFormatTag = wFormatTag;
    this.bytesPerSample = bytesPerSample;
  }
  getAudioData() {
    if (!this.rawData) return new Float32Array(0);
    if (!this.audioData) {
      let sampleData;
      switch (this.wFormatTag) {
        default:
          SpessaLog.warn(`Failed to decode sample. Unknown wFormatTag: ${this.wFormatTag}`);
          sampleData = new Float32Array(this.rawData.length / this.bytesPerSample);
          break;
        case W_FORMAT_TAG.PCM:
          sampleData = readPCM(this.rawData, this.bytesPerSample);
          break;
        case W_FORMAT_TAG.ALAW:
          sampleData = readALAW(this.rawData, this.bytesPerSample);
          break;
      }
      this.setAudioData(sampleData, this.sampleRate);
    }
    return this.audioData ?? new Float32Array(0);
  }
  getRawData(allowVorbis) {
    if (this.dataOverridden || this.isCompressed) return super.getRawData(allowVorbis);
    if (this.wFormatTag === W_FORMAT_TAG.PCM && this.bytesPerSample === 2) return this.rawData;
    return this.encodeS16LE();
  }
};
var DownloadableSoundsSample = class DownloadableSoundsSample2 extends DLSVerifier {
  waveSample = new WaveSample();
  wFormatTag;
  bytesPerSample;
  sampleRate;
  dataChunk;
  name = "Unnamed sample";
  constructor(wFormatTag, bytesPerSample, sampleRate, dataChunk) {
    super();
    this.wFormatTag = wFormatTag;
    this.bytesPerSample = bytesPerSample;
    this.sampleRate = sampleRate;
    this.dataChunk = dataChunk;
  }
  static read(waveChunk) {
    const chunks = this.verifyAndReadList(waveChunk, "wave");
    const fmtChunk = chunks.find((c) => c.header === "fmt ");
    if (!fmtChunk) throw new Error("No fmt chunk in the wave file!");
    const wFormatTag = readLittleEndianIndexed(fmtChunk.data, 2);
    const channelsAmount = readLittleEndianIndexed(fmtChunk.data, 2);
    if (channelsAmount !== 1) throw new Error(`Only mono samples are supported. Fmt reports ${channelsAmount} channels.`);
    const sampleRate = readLittleEndianIndexed(fmtChunk.data, 4);
    readLittleEndianIndexed(fmtChunk.data, 4);
    readLittleEndianIndexed(fmtChunk.data, 2);
    const bytesPerSample = readLittleEndianIndexed(fmtChunk.data, 2) / 8;
    const dataChunk = chunks.find((c) => c.header === "data");
    if (!dataChunk) throw new Error("No data chunk in the WAVE chunk!");
    const sample = new DownloadableSoundsSample2(wFormatTag, bytesPerSample, sampleRate, dataChunk);
    const waveInfo = RIFFChunk.findListType(chunks, "INFO");
    if (waveInfo) {
      let infoChunk = RIFFChunk.read(waveInfo.data);
      while (infoChunk.header !== "INAM" && waveInfo.data.currentIndex < waveInfo.data.length) infoChunk = RIFFChunk.read(waveInfo.data);
      if (infoChunk.header === "INAM") sample.name = readBinaryStringIndexed(infoChunk.data, infoChunk.size).trim();
    }
    const wsmpChunk = chunks.find((c) => c.header === "wsmp");
    if (wsmpChunk) sample.waveSample = WaveSample.read(wsmpChunk);
    return sample;
  }
  static fromSFSample(sample) {
    const raw = sample.getRawData(false);
    const dlsSample = new DownloadableSoundsSample2(1, 2, sample.sampleRate, new RIFFChunk("data", raw.length, new IndexedByteArray(raw.buffer)));
    dlsSample.name = sample.name;
    dlsSample.waveSample = WaveSample.fromSFSample(sample);
    return dlsSample;
  }
  toSFSample(soundBank) {
    let originalKey = this.waveSample.unityNote;
    let pitchCorrection = this.waveSample.fineTune;
    const samplePitchSemitones = Math.trunc(pitchCorrection / 100);
    originalKey += samplePitchSemitones;
    pitchCorrection -= samplePitchSemitones * 100;
    let loopStart = 0;
    let loopEnd = 0;
    const loop = this.waveSample.loops?.[0];
    if (loop) {
      loopStart = loop.loopStart;
      loopEnd = loop.loopStart + loop.loopLength;
    }
    const sample = new DLSSample(this.name, this.sampleRate, originalKey, pitchCorrection, loopStart, loopEnd, this.dataChunk, this.wFormatTag, this.bytesPerSample);
    soundBank.addSamples(sample);
  }
  write() {
    const fmt = this.writeFmt();
    const wsmp = this.waveSample.write();
    const data = RIFFChunk.getParts("data", [this.dataChunk.data]);
    const inam = RIFFChunk.write("INAM", getStringBytes(this.name, true));
    const info = RIFFChunk.write("INFO", inam, false, true);
    SpessaLog.info(`%cSaved %c${this.name}%c successfully!`, ConsoleColors.recognized, ConsoleColors.value, ConsoleColors.recognized);
    return RIFFChunk.getParts("wave", [
      fmt,
      wsmp,
      ...data,
      info
    ], true);
  }
  writeFmt() {
    const fmtData = new IndexedByteArray(18);
    writeWord(fmtData, this.wFormatTag);
    writeWord(fmtData, 1);
    writeDword(fmtData, this.sampleRate);
    writeDword(fmtData, this.sampleRate * 2);
    writeWord(fmtData, 2);
    writeWord(fmtData, this.bytesPerSample * 8);
    return RIFFChunk.write("fmt ", fmtData);
  }
};
var ConnectionSource = class ConnectionSource2 {
  source;
  transform;
  bipolar;
  invert;
  constructor(source = DLSSources.none, transform = ModulatorCurveTypes.linear, bipolar = false, invert = false) {
    this.source = source;
    this.transform = transform;
    this.bipolar = bipolar;
    this.invert = invert;
  }
  get sourceName() {
    return Object.keys(DLSSources).find((k) => DLSSources[k] === this.source) ?? this.source.toString();
  }
  get transformName() {
    return Object.keys(ModulatorCurveTypes).find((k) => ModulatorCurveTypes[k] === this.transform) ?? this.transform.toString();
  }
  static copyFrom(inputSource) {
    return new ConnectionSource2(inputSource.source, inputSource.transform, inputSource.bipolar, inputSource.invert);
  }
  static fromSFSource(source) {
    let sourceEnum = void 0;
    if (source.isCC) switch (source.index) {
      case MIDIControllers.modulationWheel:
        sourceEnum = DLSSources.modulationWheel;
        break;
      case MIDIControllers.mainVolume:
        sourceEnum = DLSSources.volume;
        break;
      case MIDIControllers.pan:
        sourceEnum = DLSSources.pan;
        break;
      case MIDIControllers.expression:
        sourceEnum = DLSSources.expression;
        break;
      case MIDIControllers.chorusDepth:
        sourceEnum = DLSSources.chorus;
        break;
      case MIDIControllers.reverbDepth:
        sourceEnum = DLSSources.reverb;
        break;
    }
    else switch (source.index) {
      case ModulatorControllerSources.noController:
        sourceEnum = DLSSources.none;
        break;
      case ModulatorControllerSources.noteOnKeyNum:
        sourceEnum = DLSSources.keyNum;
        break;
      case ModulatorControllerSources.noteOnVelocity:
        sourceEnum = DLSSources.velocity;
        break;
      case ModulatorControllerSources.pitchWheel:
        sourceEnum = DLSSources.pitchWheel;
        break;
      case ModulatorControllerSources.pitchWheelRange:
        sourceEnum = DLSSources.pitchWheelRange;
        break;
      case ModulatorControllerSources.polyPressure:
        sourceEnum = DLSSources.polyPressure;
        break;
      case ModulatorControllerSources.channelPressure:
        sourceEnum = DLSSources.channelPressure;
    }
    if (sourceEnum === void 0) return;
    return new ConnectionSource2(sourceEnum, source.curveType, source.isBipolar, source.isNegative);
  }
  toString() {
    return `${this.sourceName} ${this.transformName} ${this.bipolar ? "bipolar" : "unipolar"} ${this.invert ? "inverted" : "positive"}`;
  }
  toTransformFlag() {
    return this.transform | (this.bipolar ? 1 : 0) << 4 | (this.invert ? 1 : 0) << 5;
  }
  toSFSource() {
    let sourceEnum;
    let isCC = false;
    switch (this.source) {
      default:
      case DLSSources.modLfo:
      case DLSSources.vibratoLfo:
      case DLSSources.coarseTune:
      case DLSSources.fineTune:
      case DLSSources.modEnv:
        return;
      case DLSSources.keyNum:
        sourceEnum = ModulatorControllerSources.noteOnKeyNum;
        break;
      case DLSSources.none:
        sourceEnum = ModulatorControllerSources.noController;
        break;
      case DLSSources.modulationWheel:
        sourceEnum = MIDIControllers.modulationWheel;
        isCC = true;
        break;
      case DLSSources.pan:
        sourceEnum = MIDIControllers.pan;
        isCC = true;
        break;
      case DLSSources.reverb:
        sourceEnum = MIDIControllers.reverbDepth;
        isCC = true;
        break;
      case DLSSources.chorus:
        sourceEnum = MIDIControllers.chorusDepth;
        isCC = true;
        break;
      case DLSSources.expression:
        sourceEnum = MIDIControllers.expression;
        isCC = true;
        break;
      case DLSSources.volume:
        sourceEnum = MIDIControllers.mainVolume;
        isCC = true;
        break;
      case DLSSources.velocity:
        sourceEnum = ModulatorControllerSources.noteOnVelocity;
        break;
      case DLSSources.polyPressure:
        sourceEnum = ModulatorControllerSources.polyPressure;
        break;
      case DLSSources.channelPressure:
        sourceEnum = ModulatorControllerSources.channelPressure;
        break;
      case DLSSources.pitchWheel:
        sourceEnum = ModulatorControllerSources.pitchWheel;
        break;
      case DLSSources.pitchWheelRange:
        sourceEnum = ModulatorControllerSources.pitchWheelRange;
        break;
    }
    if (sourceEnum === void 0) return;
    return new ModulatorSource(sourceEnum, this.transform, isCC, this.bipolar, this.invert);
  }
};
var DEFAULT_DLS_REVERB = new DecodedModulator(219, 0, GeneratorTypes.reverbEffectsSend, 1e3, 0);
var DEFAULT_DLS_CHORUS = new DecodedModulator(221, 0, GeneratorTypes.chorusEffectsSend, 1e3, 0);
new DecodedModulator(129, 0, GeneratorTypes.vibLfoToPitch, 0, 0);
new DecodedModulator(13, 0, GeneratorTypes.vibLfoToPitch, 0, 0);
var invalidGeneratorTypes = /* @__PURE__ */ new Set([
  GeneratorTypes.sampleModes,
  GeneratorTypes.initialAttenuation,
  GeneratorTypes.keyRange,
  GeneratorTypes.velRange,
  GeneratorTypes.sampleID,
  GeneratorTypes.fineTune,
  GeneratorTypes.coarseTune,
  GeneratorTypes.startAddrsOffset,
  GeneratorTypes.startAddrsCoarseOffset,
  GeneratorTypes.endAddrOffset,
  GeneratorTypes.endAddrsCoarseOffset,
  GeneratorTypes.startloopAddrsOffset,
  GeneratorTypes.startloopAddrsCoarseOffset,
  GeneratorTypes.endloopAddrsOffset,
  GeneratorTypes.endloopAddrsCoarseOffset,
  GeneratorTypes.overridingRootKey,
  GeneratorTypes.exclusiveClass
]);
var ConnectionBlock = class ConnectionBlock2 {
  /**
  * Like SF2 modulator source.
  */
  source;
  /**
  * Like SF2 modulator secondary source.
  */
  control;
  /**
  * Like SF2 destination.
  */
  destination;
  /**
  * Like SF2 amount, but long (32-bit) instead of short.
  */
  scale;
  /**
  * Like SF2 source transforms.
  */
  transform;
  constructor(source = new ConnectionSource(), control = new ConnectionSource(), destination, transform, scale) {
    this.source = source;
    this.control = control;
    this.destination = destination;
    this.transform = transform;
    this.scale = scale;
  }
  get isStaticParameter() {
    return this.source.source === DLSSources.none && this.control.source === DLSSources.none;
  }
  get shortScale() {
    return this.scale >> 16;
  }
  get transformName() {
    return Object.keys(ModulatorCurveTypes).find((k) => ModulatorCurveTypes[k] === this.transform) ?? this.transform.toString();
  }
  get destinationName() {
    return Object.keys(DLSDestinations).find((k) => DLSDestinations[k] === this.destination) ?? this.destination.toString();
  }
  static read(artData) {
    const usSource = readLittleEndianIndexed(artData, 2);
    const usControl = readLittleEndianIndexed(artData, 2);
    const usDestination = readLittleEndianIndexed(artData, 2);
    const usTransform = readLittleEndianIndexed(artData, 2);
    const lScale = readLittleEndianIndexed(artData, 4) | 0;
    const transform = usTransform & 15;
    const control = new ConnectionSource(usControl, usTransform >> 4 & 15, bitMaskToBool(usTransform, 8), bitMaskToBool(usTransform, 9));
    return new ConnectionBlock2(new ConnectionSource(usSource, usTransform >> 10 & 15, bitMaskToBool(usTransform, 14), bitMaskToBool(usTransform, 15)), control, usDestination, transform, lScale);
  }
  static fromSFModulator(m, articulation) {
    const failed = (msg) => {
      SpessaLog.warn(`Failed converting SF modulator into DLS:
 ${m.toString()} 
(${msg})`);
    };
    if (m.transformType !== 0) {
      failed("Absolute transform type is not supported");
      return;
    }
    if (Modulator.isIdentical(m, DEFAULT_DLS_CHORUS, true) || Modulator.isIdentical(m, DEFAULT_DLS_REVERB, true)) return;
    let source = ConnectionSource.fromSFSource(m.primarySource);
    if (!source) {
      failed("Invalid primary source");
      return;
    }
    let control = ConnectionSource.fromSFSource(m.secondarySource);
    if (!control) {
      failed("Invalid secondary source");
      return;
    }
    const dlsDestination = ConnectionBlock2.fromSFDestination(m.destination, m.transformAmount);
    if (dlsDestination === void 0) {
      failed("Invalid destination");
      return;
    }
    let amount = m.transformAmount;
    let destination;
    if (typeof dlsDestination === "number") destination = dlsDestination;
    else {
      destination = dlsDestination.destination;
      amount = dlsDestination.amount;
      if (dlsDestination.source !== DLSSources.none) {
        if (control.source !== DLSSources.none && source.source !== DLSSources.none) {
          failed("Articulation generators with secondary source are not supported");
          return;
        }
        if (source.source !== DLSSources.none) control = source;
        source = new ConnectionSource(dlsDestination.source, ModulatorCurveTypes.linear, dlsDestination.isBipolar);
      }
    }
    const bloc = new ConnectionBlock2(source, control, destination, 0, amount << 16);
    articulation.connectionBlocks.push(bloc);
  }
  static copyFrom(inputBlock) {
    return new ConnectionBlock2(ConnectionSource.copyFrom(inputBlock.source), ConnectionSource.copyFrom(inputBlock.control), inputBlock.destination, inputBlock.transform, inputBlock.scale);
  }
  static fromSFGenerator(generator, articulation) {
    if (invalidGeneratorTypes.has(generator.type)) return;
    const failed = (msg) => {
      SpessaLog.warn(`Failed converting SF2 generator into DLS:
 ${generator.toString()} 
(${msg})`);
    };
    const dlsDestination = ConnectionBlock2.fromSFDestination(generator.type, generator.value);
    if (dlsDestination === void 0) {
      failed("Invalid type");
      return;
    }
    const source = new ConnectionSource();
    let destination;
    let amount = generator.value;
    if (typeof dlsDestination === "number") destination = dlsDestination;
    else {
      destination = dlsDestination.destination;
      amount = dlsDestination.amount;
      source.source = dlsDestination.source;
      source.bipolar = dlsDestination.isBipolar;
    }
    articulation.connectionBlocks.push(new ConnectionBlock2(source, new ConnectionSource(), destination, 0, amount << 16));
  }
  static fromSFDestination(dest, amount) {
    switch (dest) {
      default:
        return;
      case GeneratorTypes.initialAttenuation:
        return {
          destination: DLSDestinations.gain,
          amount: -amount,
          isBipolar: false,
          source: DLSSources.none
        };
      case GeneratorTypes.fineTune:
        return DLSDestinations.pitch;
      case GeneratorTypes.pan:
        return DLSDestinations.pan;
      case GeneratorTypes.keyNum:
        return DLSDestinations.keyNum;
      case GeneratorTypes.reverbEffectsSend:
        return DLSDestinations.reverbSend;
      case GeneratorTypes.chorusEffectsSend:
        return DLSDestinations.chorusSend;
      case GeneratorTypes.freqModLFO:
        return DLSDestinations.modLfoFreq;
      case GeneratorTypes.delayModLFO:
        return DLSDestinations.modLfoDelay;
      case GeneratorTypes.delayVibLFO:
        return DLSDestinations.vibLfoDelay;
      case GeneratorTypes.freqVibLFO:
        return DLSDestinations.vibLfoFreq;
      case GeneratorTypes.delayVolEnv:
        return DLSDestinations.volEnvDelay;
      case GeneratorTypes.attackVolEnv:
        return DLSDestinations.volEnvAttack;
      case GeneratorTypes.holdVolEnv:
        return DLSDestinations.volEnvHold;
      case GeneratorTypes.decayVolEnv:
        return DLSDestinations.volEnvDecay;
      case GeneratorTypes.sustainVolEnv:
        return {
          destination: DLSDestinations.volEnvSustain,
          amount: 1e3 - amount,
          isBipolar: false,
          source: DLSSources.none
        };
      case GeneratorTypes.releaseVolEnv:
        return DLSDestinations.volEnvRelease;
      case GeneratorTypes.delayModEnv:
        return DLSDestinations.modEnvDelay;
      case GeneratorTypes.attackModEnv:
        return DLSDestinations.modEnvAttack;
      case GeneratorTypes.holdModEnv:
        return DLSDestinations.modEnvHold;
      case GeneratorTypes.decayModEnv:
        return DLSDestinations.modEnvDecay;
      case GeneratorTypes.sustainModEnv:
        return {
          destination: DLSDestinations.modEnvSustain,
          amount: 1e3 - amount,
          isBipolar: false,
          source: DLSSources.none
        };
      case GeneratorTypes.releaseModEnv:
        return DLSDestinations.modEnvRelease;
      case GeneratorTypes.initialFilterFc:
        return DLSDestinations.filterCutoff;
      case GeneratorTypes.initialFilterQ:
        return DLSDestinations.filterQ;
      case GeneratorTypes.modEnvToFilterFc:
        return {
          source: DLSSources.modEnv,
          destination: DLSDestinations.filterCutoff,
          amount,
          isBipolar: false
        };
      case GeneratorTypes.modEnvToPitch:
        return {
          source: DLSSources.modEnv,
          destination: DLSDestinations.pitch,
          amount,
          isBipolar: false
        };
      case GeneratorTypes.modLfoToFilterFc:
        return {
          source: DLSSources.modLfo,
          destination: DLSDestinations.filterCutoff,
          amount,
          isBipolar: true
        };
      case GeneratorTypes.modLfoToVolume:
        return {
          source: DLSSources.modLfo,
          destination: DLSDestinations.gain,
          amount,
          isBipolar: true
        };
      case GeneratorTypes.modLfoToPitch:
        return {
          source: DLSSources.modLfo,
          destination: DLSDestinations.pitch,
          amount,
          isBipolar: true
        };
      case GeneratorTypes.vibLfoToPitch:
        return {
          source: DLSSources.vibratoLfo,
          destination: DLSDestinations.pitch,
          amount,
          isBipolar: true
        };
      case GeneratorTypes.keyNumToVolEnvHold:
        return {
          source: DLSSources.keyNum,
          destination: DLSDestinations.volEnvHold,
          amount,
          isBipolar: true
        };
      case GeneratorTypes.keyNumToVolEnvDecay:
        return {
          source: DLSSources.keyNum,
          destination: DLSDestinations.volEnvDecay,
          amount,
          isBipolar: true
        };
      case GeneratorTypes.keyNumToModEnvHold:
        return {
          source: DLSSources.keyNum,
          destination: DLSDestinations.modEnvHold,
          amount,
          isBipolar: true
        };
      case GeneratorTypes.keyNumToModEnvDecay:
        return {
          source: DLSSources.keyNum,
          destination: DLSDestinations.modEnvDecay,
          amount,
          isBipolar: true
        };
      case GeneratorTypes.scaleTuning:
        return {
          source: DLSSources.keyNum,
          destination: DLSDestinations.pitch,
          amount: amount * 128,
          isBipolar: false
        };
    }
  }
  toString() {
    return `Source: ${this.source.toString()},
Control: ${this.control.toString()},
Scale: ${this.scale} >> 16 = ${this.shortScale},
Output transform: ${this.transformName}
Destination: ${this.destinationName}`;
  }
  write() {
    const out = new IndexedByteArray(12);
    writeWord(out, this.source.source);
    writeWord(out, this.control.source);
    writeWord(out, this.destination);
    writeWord(out, this.transform | this.control.toTransformFlag() << 4 | this.source.toTransformFlag() << 10);
    writeDword(out, this.scale);
    return out;
  }
  toSFGenerator(zone) {
    const destination = this.destination;
    const value = this.shortScale;
    switch (destination) {
      default:
        SpessaLog.info(`%cFailed converting DLS articulator into SF generator: %c${this.toString()}%c
(invalid destination)`, ConsoleColors.warn, ConsoleColors.value, ConsoleColors.unrecognized);
        return;
      case DLSDestinations.pan:
        zone.setGenerator(GeneratorTypes.pan, value);
        break;
      case DLSDestinations.gain:
        zone.addToGenerator(GeneratorTypes.initialAttenuation, -value / 0.4);
        break;
      case DLSDestinations.filterCutoff:
        zone.setGenerator(GeneratorTypes.initialFilterFc, value);
        break;
      case DLSDestinations.filterQ:
        zone.setGenerator(GeneratorTypes.initialFilterQ, value);
        break;
      case DLSDestinations.modLfoFreq:
        zone.setGenerator(GeneratorTypes.freqModLFO, value);
        break;
      case DLSDestinations.modLfoDelay:
        zone.setGenerator(GeneratorTypes.delayModLFO, value);
        break;
      case DLSDestinations.vibLfoFreq:
        zone.setGenerator(GeneratorTypes.freqVibLFO, value);
        break;
      case DLSDestinations.vibLfoDelay:
        zone.setGenerator(GeneratorTypes.delayVibLFO, value);
        break;
      case DLSDestinations.volEnvDelay:
        zone.setGenerator(GeneratorTypes.delayVolEnv, value);
        break;
      case DLSDestinations.volEnvAttack:
        zone.setGenerator(GeneratorTypes.attackVolEnv, value);
        break;
      case DLSDestinations.volEnvHold:
        zone.setGenerator(GeneratorTypes.holdVolEnv, value);
        break;
      case DLSDestinations.volEnvDecay:
        zone.setGenerator(GeneratorTypes.decayVolEnv, value);
        break;
      case DLSDestinations.volEnvRelease:
        zone.setGenerator(GeneratorTypes.releaseVolEnv, value);
        break;
      case DLSDestinations.volEnvSustain:
        zone.setGenerator(GeneratorTypes.sustainVolEnv, 1e3 - value);
        break;
      case DLSDestinations.modEnvDelay:
        zone.setGenerator(GeneratorTypes.delayModEnv, value);
        break;
      case DLSDestinations.modEnvAttack:
        zone.setGenerator(GeneratorTypes.attackModEnv, value);
        break;
      case DLSDestinations.modEnvHold:
        zone.setGenerator(GeneratorTypes.holdModEnv, value);
        break;
      case DLSDestinations.modEnvDecay:
        zone.setGenerator(GeneratorTypes.decayModEnv, value);
        break;
      case DLSDestinations.modEnvRelease:
        zone.setGenerator(GeneratorTypes.releaseModEnv, value);
        break;
      case DLSDestinations.modEnvSustain:
        zone.setGenerator(GeneratorTypes.sustainModEnv, 1e3 - value);
        break;
      case DLSDestinations.reverbSend:
        zone.setGenerator(GeneratorTypes.reverbEffectsSend, value);
        break;
      case DLSDestinations.chorusSend:
        zone.setGenerator(GeneratorTypes.chorusEffectsSend, value);
        break;
      case DLSDestinations.pitch:
        zone.fineTuning += value;
        break;
    }
  }
  toSFModulator(zone) {
    let amount = this.shortScale;
    let modulatorDestination;
    let primarySource;
    let secondarySource = new ModulatorSource();
    const specialDestination = this.toCombinedSFDestination();
    if (specialDestination) {
      modulatorDestination = specialDestination;
      const controlSF = this.control.toSFSource();
      if (!controlSF) {
        this.failedConversion("Invalid control");
        return;
      }
      primarySource = controlSF;
    } else {
      const convertedDestination = this.toSFDestination();
      if (!convertedDestination) {
        this.failedConversion("Invalid destination");
        return;
      }
      if (typeof convertedDestination === "object") {
        amount = convertedDestination.newAmount;
        modulatorDestination = convertedDestination.gen;
      } else modulatorDestination = convertedDestination;
      const convertedPrimary = this.source.toSFSource();
      if (!convertedPrimary) {
        this.failedConversion("Invalid source");
        return;
      }
      primarySource = convertedPrimary;
      const convertedSecondary = this.control.toSFSource();
      if (!convertedSecondary) {
        this.failedConversion("Invalid control");
        return;
      }
      secondarySource = convertedSecondary;
    }
    if (this.transform !== ModulatorCurveTypes.linear && primarySource.curveType === ModulatorCurveTypes.linear) primarySource.curveType = this.transform;
    if (modulatorDestination === GeneratorTypes.initialAttenuation) {
      if (this.source.source === DLSSources.velocity || this.source.source === DLSSources.volume || this.source.source === DLSSources.expression) primarySource.isNegative = true;
      amount = Math.min(960, Math.max(0, amount));
    }
    const mod = new Modulator(primarySource, secondarySource, modulatorDestination, amount, 0);
    zone.addModulators(mod);
  }
  /**
  * Checks for an SF generator that consists of DLS source and destination (such as mod LFO and pitch)
  * @returns either a matching SF generator or nothing.
  */
  toCombinedSFDestination() {
    const source = this.source.source;
    const destination = this.destination;
    if (source === DLSSources.vibratoLfo && destination === DLSDestinations.pitch) return GeneratorTypes.vibLfoToPitch;
    else if (source === DLSSources.modLfo && destination === DLSDestinations.pitch) return GeneratorTypes.modLfoToPitch;
    else if (source === DLSSources.modLfo && destination === DLSDestinations.filterCutoff) return GeneratorTypes.modLfoToFilterFc;
    else if (source === DLSSources.modLfo && destination === DLSDestinations.gain) return GeneratorTypes.modLfoToVolume;
    else if (source === DLSSources.modEnv && destination === DLSDestinations.filterCutoff) return GeneratorTypes.modEnvToFilterFc;
    else if (source === DLSSources.modEnv && destination === DLSDestinations.pitch) return GeneratorTypes.modEnvToPitch;
    else return;
  }
  failedConversion(msg) {
    SpessaLog.info(`%cFailed converting DLS articulator into SF2:
 %c${this.toString()}%c
(${msg})`, ConsoleColors.warn, ConsoleColors.value, ConsoleColors.unrecognized);
  }
  /**
  * Converts DLS destination of this block to an SF2 one, also with the correct amount.
  * @private
  */
  toSFDestination() {
    const amount = this.shortScale;
    switch (this.destination) {
      default:
      case DLSDestinations.none:
        return;
      case DLSDestinations.pan:
        return GeneratorTypes.pan;
      case DLSDestinations.gain:
        return {
          gen: GeneratorTypes.initialAttenuation,
          newAmount: -amount
        };
      case DLSDestinations.pitch:
        return GeneratorTypes.fineTune;
      case DLSDestinations.keyNum:
        return GeneratorTypes.overridingRootKey;
      case DLSDestinations.volEnvDelay:
        return GeneratorTypes.delayVolEnv;
      case DLSDestinations.volEnvAttack:
        return GeneratorTypes.attackVolEnv;
      case DLSDestinations.volEnvHold:
        return GeneratorTypes.holdVolEnv;
      case DLSDestinations.volEnvDecay:
        return GeneratorTypes.decayVolEnv;
      case DLSDestinations.volEnvSustain:
        return {
          gen: GeneratorTypes.sustainVolEnv,
          newAmount: 1e3 - amount
        };
      case DLSDestinations.volEnvRelease:
        return GeneratorTypes.releaseVolEnv;
      case DLSDestinations.modEnvDelay:
        return GeneratorTypes.delayModEnv;
      case DLSDestinations.modEnvAttack:
        return GeneratorTypes.attackModEnv;
      case DLSDestinations.modEnvHold:
        return GeneratorTypes.holdModEnv;
      case DLSDestinations.modEnvDecay:
        return GeneratorTypes.decayModEnv;
      case DLSDestinations.modEnvSustain:
        return {
          gen: GeneratorTypes.sustainModEnv,
          newAmount: 1e3 - amount
        };
      case DLSDestinations.modEnvRelease:
        return GeneratorTypes.releaseModEnv;
      case DLSDestinations.filterCutoff:
        return GeneratorTypes.initialFilterFc;
      case DLSDestinations.filterQ:
        return GeneratorTypes.initialFilterQ;
      case DLSDestinations.chorusSend:
        return GeneratorTypes.chorusEffectsSend;
      case DLSDestinations.reverbSend:
        return GeneratorTypes.reverbEffectsSend;
      case DLSDestinations.modLfoFreq:
        return GeneratorTypes.freqModLFO;
      case DLSDestinations.modLfoDelay:
        return GeneratorTypes.delayModLFO;
      case DLSDestinations.vibLfoFreq:
        return GeneratorTypes.freqVibLFO;
      case DLSDestinations.vibLfoDelay:
        return GeneratorTypes.delayVibLFO;
    }
  }
};
var DownloadableSoundsArticulation = class extends DLSVerifier {
  connectionBlocks = new Array();
  mode = "dls2";
  get length() {
    return this.connectionBlocks.length;
  }
  copyFrom(inputArticulation) {
    this.mode = inputArticulation.mode;
    for (const block of inputArticulation.connectionBlocks) this.connectionBlocks.push(ConnectionBlock.copyFrom(block));
  }
  fromSFZone(z) {
    this.mode = "dls2";
    const zone = new BasicZone();
    zone.copyFrom(z);
    for (const relativeGenerator of zone.generators) {
      let absoluteCounterpart;
      switch (relativeGenerator.type) {
        default:
          continue;
        case GeneratorTypes.keyNumToVolEnvDecay:
          absoluteCounterpart = GeneratorTypes.decayVolEnv;
          break;
        case GeneratorTypes.keyNumToVolEnvHold:
          absoluteCounterpart = GeneratorTypes.holdVolEnv;
          break;
        case GeneratorTypes.keyNumToModEnvDecay:
          absoluteCounterpart = GeneratorTypes.decayModEnv;
          break;
        case GeneratorTypes.keyNumToModEnvHold:
          absoluteCounterpart = GeneratorTypes.holdModEnv;
      }
      const absoluteValue = zone.getGenerator(absoluteCounterpart, void 0);
      const dlsRelative = relativeGenerator.value * -128;
      if (absoluteValue === void 0) continue;
      const newAbsolute = absoluteValue - 60 / 128 * dlsRelative;
      zone.setGenerator(relativeGenerator.type, dlsRelative, false);
      zone.setGenerator(absoluteCounterpart, newAbsolute, false);
    }
    for (const generator of zone.generators) ConnectionBlock.fromSFGenerator(generator, this);
    for (const modulator of zone.modulators) ConnectionBlock.fromSFModulator(modulator, this);
  }
  /**
  * Chunk list for the region/instrument (containing lar2 or lart)
  * @param chunks
  */
  read(chunks) {
    const lart = RIFFChunk.findListType(chunks, "lart");
    const lar2 = RIFFChunk.findListType(chunks, "lar2");
    if (lart) {
      this.mode = "dls1";
      while (lart.data.currentIndex < lart.data.length) {
        const chunk = RIFFChunk.read(lart.data);
        if (chunk.header !== "art1" && chunk.header !== "art2") continue;
        const artData = chunk.data;
        const cbSize = readLittleEndianIndexed(artData, 4);
        if (cbSize !== 8) SpessaLog.warn(`CbSize in articulation mismatch. Expected 8, got ${cbSize}`);
        const connectionsAmount = readLittleEndianIndexed(artData, 4);
        for (let i = 0; i < connectionsAmount; i++) this.connectionBlocks.push(ConnectionBlock.read(artData));
      }
    } else if (lar2) {
      this.mode = "dls2";
      while (lar2.data.currentIndex < lar2.data.length) {
        const chunk = RIFFChunk.read(lar2.data);
        if (chunk.header !== "art1" && chunk.header !== "art2") continue;
        const artData = chunk.data;
        const cbSize = readLittleEndianIndexed(artData, 4);
        if (cbSize !== 8) SpessaLog.warn(`CbSize in articulation mismatch. Expected 8, got ${cbSize}`);
        const connectionsAmount = readLittleEndianIndexed(artData, 4);
        for (let i = 0; i < connectionsAmount; i++) this.connectionBlocks.push(ConnectionBlock.read(artData));
      }
    }
  }
  /**
  * Note: this writes "lar2", not just "art2"
  */
  write() {
    const art2Data = new IndexedByteArray(8);
    writeDword(art2Data, 8);
    writeDword(art2Data, this.connectionBlocks.length);
    const out = this.connectionBlocks.map((a) => a.write());
    const art2 = RIFFChunk.getParts(this.mode === "dls2" ? "art2" : "art1", [art2Data, ...out]);
    return RIFFChunk.getParts(this.mode === "dls2" ? "lar2" : "lart", art2, true);
  }
  /**
  * Converts DLS articulation into an SF zone.
  * @param zone The zone to write to.
  */
  toSFZone(zone) {
    const applyKeyToCorrection = (value, keyToGen, realGen, dlsDestination) => {
      const keyToGenValue = value / -128;
      zone.setGenerator(keyToGen, keyToGenValue);
      if (keyToGenValue <= 120) {
        const correction = Math.round(60 / 128 * value);
        const realValueConnection = this.connectionBlocks.find((block) => block.isStaticParameter && block.destination === dlsDestination);
        if (realValueConnection) zone.setGenerator(realGen, correction + realValueConnection.shortScale);
      }
    };
    for (const connection of this.connectionBlocks) {
      const amount = connection.shortScale;
      const source = connection.source.source;
      const control = connection.control.source;
      const destination = connection.destination;
      if (connection.isStaticParameter) {
        connection.toSFGenerator(zone);
        continue;
      }
      if (control === DLSSources.none) if (source === DLSSources.keyNum) {
        if (destination === DLSDestinations.pitch) {
          zone.setGenerator(GeneratorTypes.scaleTuning, amount / 128);
          continue;
        }
        if (destination === DLSDestinations.modEnvHold || destination === DLSDestinations.modEnvDecay || destination === DLSDestinations.volEnvHold || destination === DLSDestinations.volEnvDecay) continue;
      } else {
        const specialGen = connection.toCombinedSFDestination();
        if (specialGen) {
          zone.setGenerator(specialGen, amount);
          continue;
        }
      }
      connection.toSFModulator(zone);
    }
    for (const connection of this.connectionBlocks) {
      if (connection.source.source !== DLSSources.keyNum) continue;
      const generatorAmount = connection.shortScale;
      switch (connection.destination) {
        default:
        case DLSDestinations.volEnvHold:
          applyKeyToCorrection(generatorAmount, GeneratorTypes.keyNumToVolEnvHold, GeneratorTypes.holdVolEnv, DLSDestinations.volEnvHold);
          break;
        case DLSDestinations.volEnvDecay:
          applyKeyToCorrection(generatorAmount, GeneratorTypes.keyNumToVolEnvDecay, GeneratorTypes.decayVolEnv, DLSDestinations.volEnvDecay);
          break;
        case DLSDestinations.modEnvHold:
          applyKeyToCorrection(generatorAmount, GeneratorTypes.keyNumToModEnvHold, GeneratorTypes.holdModEnv, DLSDestinations.modEnvHold);
          break;
        case DLSDestinations.modEnvDecay:
          applyKeyToCorrection(generatorAmount, GeneratorTypes.keyNumToModEnvDecay, GeneratorTypes.decayModEnv, DLSDestinations.modEnvDecay);
          break;
      }
    }
    if (this.mode === "dls1") {
      zone.setGenerator(GeneratorTypes.delayVibLFO, zone.getGenerator(GeneratorTypes.delayModLFO, null));
      zone.setGenerator(GeneratorTypes.freqVibLFO, zone.getGenerator(GeneratorTypes.freqModLFO, null));
      zone.setGenerator(GeneratorTypes.vibLfoToPitch, zone.getGenerator(GeneratorTypes.modLfoToPitch, null));
      zone.setGenerator(GeneratorTypes.modLfoToPitch, null);
      for (const mod of zone.modulators) if (mod.destination === GeneratorTypes.modLfoToPitch) mod.destination = GeneratorTypes.vibLfoToPitch;
    }
  }
};
var WaveLink = class WaveLink2 {
  /**
  * Specifies the channel placement of the sample. This is used to place mono sounds within a
  * stereo pair or for multi-track placement. Each bit position within the ulChannel field specifies
  * a channel placement with bit 0 specifying a mono sample or the left channel of a stereo file.
  */
  channel = 1;
  /**
  * Specifies the 0 based index of the cue entry in the wave pool table.
  */
  tableIndex;
  /**
  * Specifies flag options for this wave link. All bits not defined must be set to 0.
  */
  fusOptions = 0;
  /**
  * Specifies a group number for samples which are phase locked. All waves in a set of wave
  * links with the same group are phase locked and follow the wave in the group with the
  * F_WAVELINK_PHASE_MASTER flag set. If a wave is not a member of a phase locked
  * group, this value should be set to 0.
  */
  phaseGroup = 0;
  constructor(tableIndex) {
    this.tableIndex = tableIndex;
  }
  static copyFrom(waveLink) {
    const wlnk = new WaveLink2(waveLink.tableIndex);
    wlnk.channel = waveLink.channel;
    wlnk.phaseGroup = waveLink.phaseGroup;
    wlnk.fusOptions = waveLink.fusOptions;
    return wlnk;
  }
  static read(chunk) {
    const fusOptions = readLittleEndianIndexed(chunk.data, 2);
    const phaseGroup = readLittleEndianIndexed(chunk.data, 2);
    const ulChannel = readLittleEndianIndexed(chunk.data, 4);
    const wlnk = new WaveLink2(readLittleEndianIndexed(chunk.data, 4));
    wlnk.channel = ulChannel;
    wlnk.fusOptions = fusOptions;
    wlnk.phaseGroup = phaseGroup;
    return wlnk;
  }
  static fromSFZone(samples, zone) {
    const index = samples.indexOf(zone.sample);
    if (index === -1) throw new Error(`Wave link error: Sample ${zone.sample.name} does not exist in the sample list.`);
    const waveLink = new WaveLink2(index);
    switch (zone.sample.sampleType) {
      default:
      case SampleTypes.leftSample:
      case SampleTypes.monoSample:
        waveLink.channel = Math.trunc(1);
        break;
      case SampleTypes.rightSample:
        waveLink.channel = 2;
    }
    return waveLink;
  }
  write() {
    const wlnkData = new IndexedByteArray(12);
    writeWord(wlnkData, this.fusOptions);
    writeWord(wlnkData, this.phaseGroup);
    writeDword(wlnkData, this.channel);
    writeDword(wlnkData, this.tableIndex);
    return RIFFChunk.write("wlnk", wlnkData);
  }
};
var DownloadableSoundsRegion = class DownloadableSoundsRegion2 extends DLSVerifier {
  articulation = new DownloadableSoundsArticulation();
  /**
  * Specifies the key range for this region.
  */
  keyRange = {
    min: 0,
    max: 127
  };
  /**
  * Specifies the velocity range for this region.
  */
  velRange = {
    min: 0,
    max: 127
  };
  /**
  * Specifies the key group for a drum instrument. Key group values allow multiple regions
  * within a drum instrument to belong to the same "key group." If a synthesis engine is
  * instructed to play a note with a key group setting and any other notes are currently playing
  * with this same key group, then the synthesis engine should turn off all notes with the same
  * key group value as soon as possible.
  */
  keyGroup = 0;
  /**
  * Specifies flag options for the synthesis of this region.
  */
  fusOptions = 0;
  /**
  * Indicates the layer of this region for editing purposes. This field facilitates the
  * organization of overlapping regions into layers for display to the user of a DLS sound editor.
  * For example, if a piano sound and a string section are overlapped to create a piano/string pad,
  * all the regions of the piano might be labeled as layer 1, and all the regions of the string
  * section might be labeled as layer 2
  */
  usLayer = 0;
  waveSample;
  waveLink;
  constructor(waveLink, waveSample) {
    super();
    this.waveSample = waveSample;
    this.waveLink = waveLink;
  }
  static copyFrom(inputRegion) {
    const outputRegion = new DownloadableSoundsRegion2(WaveLink.copyFrom(inputRegion.waveLink), WaveSample.copyFrom(inputRegion.waveSample));
    outputRegion.keyGroup = inputRegion.keyGroup;
    outputRegion.keyRange = { ...inputRegion.keyRange };
    outputRegion.velRange = { ...inputRegion.velRange };
    outputRegion.usLayer = inputRegion.usLayer;
    outputRegion.fusOptions = inputRegion.fusOptions;
    outputRegion.articulation.copyFrom(inputRegion.articulation);
    return outputRegion;
  }
  static read(samples, chunk) {
    const regionChunks = this.verifyAndReadList(chunk, "rgn ", "rgn2");
    const waveSampleChunk = regionChunks.find((c) => c.header === "wsmp");
    let waveSample = waveSampleChunk ? WaveSample.read(waveSampleChunk) : void 0;
    const waveLinkChunk = regionChunks.find((c) => c.header === "wlnk");
    if (!waveLinkChunk) {
      SpessaLog.warn("Invalid DLS region: missing 'wlnk' chunk! Discarding...");
      return;
    }
    const waveLink = WaveLink.read(waveLinkChunk);
    const regionHeader = regionChunks.find((c) => c.header === "rgnh");
    if (!regionHeader) {
      SpessaLog.warn("Invalid DLS region: missing 'rgnh' chunk! Discarding...");
      return;
    }
    const sample = samples[waveLink.tableIndex];
    if (!sample) DownloadableSoundsRegion2.parsingError(`Invalid sample index: ${waveLink.tableIndex}. Samples available: ${samples.length}`);
    waveSample ??= sample.waveSample;
    const region = new DownloadableSoundsRegion2(waveLink, waveSample);
    const keyMin = readLittleEndianIndexed(regionHeader.data, 2);
    const keyMax = readLittleEndianIndexed(regionHeader.data, 2);
    let velMin = readLittleEndianIndexed(regionHeader.data, 2);
    let velMax = readLittleEndianIndexed(regionHeader.data, 2);
    if (velMin === 0 && velMax === 0) {
      velMax = 127;
      velMin = 0;
    }
    region.keyRange.max = keyMax;
    region.keyRange.min = keyMin;
    region.velRange.max = velMax;
    region.velRange.min = velMin;
    region.fusOptions = readLittleEndianIndexed(regionHeader.data, 2);
    region.keyGroup = readLittleEndianIndexed(regionHeader.data, 2);
    if (regionHeader.data.length - regionHeader.data.currentIndex >= 2) region.usLayer = readLittleEndianIndexed(regionHeader.data, 2);
    region.articulation.read(regionChunks);
    return region;
  }
  static fromSFZone(zone, samples) {
    const waveSample = WaveSample.fromSFZone(zone);
    const region = new DownloadableSoundsRegion2(WaveLink.fromSFZone(samples, zone), waveSample);
    region.keyRange.min = Math.max(zone.keyRange.min, 0);
    region.keyRange.max = zone.keyRange.max;
    region.velRange.min = Math.max(zone.velRange.min, 0);
    region.velRange.max = zone.velRange.max;
    region.keyGroup = zone.getGenerator(GeneratorTypes.exclusiveClass, 0);
    region.articulation.fromSFZone(zone);
    return region;
  }
  write() {
    const chunks = [
      this.writeHeader(),
      this.waveSample.write(),
      this.waveLink.write(),
      ...this.articulation.write()
    ];
    return RIFFChunk.getParts("rgn2", chunks, true);
  }
  toSFZone(instrument, samples) {
    const sample = samples[this.waveLink.tableIndex];
    if (!sample) DownloadableSoundsRegion2.parsingError(`Invalid sample index: ${this.waveLink.tableIndex}`);
    const zone = instrument.createZone(sample);
    zone.keyRange = this.keyRange;
    zone.velRange = this.velRange;
    if (this.keyRange.max === 127 && this.keyRange.min === 0) zone.keyRange.min = -1;
    if (this.velRange.max === 127 && this.velRange.min === 0) zone.velRange.min = -1;
    if (this.keyGroup !== 0) zone.setGenerator(GeneratorTypes.exclusiveClass, this.keyGroup);
    this.waveSample.toSFZone(zone, sample);
    this.articulation.toSFZone(zone);
    zone.generators = zone.generators.filter((g) => g.value !== GeneratorLimits[g.type].def);
    return zone;
  }
  writeHeader() {
    const rgnhData = new IndexedByteArray(14);
    writeWord(rgnhData, Math.max(this.keyRange.min, 0));
    writeWord(rgnhData, this.keyRange.max);
    writeWord(rgnhData, Math.max(this.velRange.min, 0));
    writeWord(rgnhData, this.velRange.max);
    writeWord(rgnhData, this.fusOptions);
    writeWord(rgnhData, this.keyGroup);
    writeWord(rgnhData, this.usLayer);
    return RIFFChunk.write("rgnh", rgnhData);
  }
};
var DownloadableSoundsInstrument = class DownloadableSoundsInstrument2 extends DLSVerifier {
  articulation = new DownloadableSoundsArticulation();
  regions = new Array();
  name = "Unnamed";
  bankLSB = 0;
  bankMSB = 0;
  isGMGSDrum = false;
  program = 0;
  static copyFrom(inputInstrument) {
    const outputInstrument = new DownloadableSoundsInstrument2();
    outputInstrument.name = inputInstrument.name;
    outputInstrument.isGMGSDrum = inputInstrument.isGMGSDrum;
    outputInstrument.bankMSB = inputInstrument.bankMSB;
    outputInstrument.bankLSB = inputInstrument.bankLSB;
    outputInstrument.program = inputInstrument.program;
    outputInstrument.articulation.copyFrom(inputInstrument.articulation);
    for (const region of inputInstrument.regions) outputInstrument.regions.push(DownloadableSoundsRegion.copyFrom(region));
    return outputInstrument;
  }
  static read(samples, chunk) {
    const chunks = this.verifyAndReadList(chunk, "ins ");
    const instrumentHeader = chunks.find((c) => c.header === "insh");
    if (!instrumentHeader) {
      SpessaLog.groupEnd();
      throw new Error("No instrument header!");
    }
    let instrumentName = ``;
    const infoChunk = RIFFChunk.findListType(chunks, "INFO");
    if (infoChunk) {
      let info = RIFFChunk.read(infoChunk.data);
      while (info.header !== "INAM") info = RIFFChunk.read(infoChunk.data);
      instrumentName = readBinaryStringIndexed(info.data, info.data.length).trim();
    }
    if (instrumentName.length === 0) instrumentName = `Unnamed Instrument`;
    const instrument = new DownloadableSoundsInstrument2();
    instrument.name = instrumentName;
    const regions = readLittleEndianIndexed(instrumentHeader.data, 4);
    const ulBank = readLittleEndianIndexed(instrumentHeader.data, 4);
    instrument.program = readLittleEndianIndexed(instrumentHeader.data, 4) & 127;
    instrument.bankMSB = ulBank >>> 8 & 127;
    instrument.bankLSB = ulBank & 127;
    instrument.isGMGSDrum = ulBank >>> 31 > 0;
    SpessaLog.groupCollapsed(`%cParsing %c"${instrumentName}"%c...`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info);
    const regionListChunk = RIFFChunk.findListType(chunks, "lrgn");
    if (!regionListChunk) {
      SpessaLog.groupEnd();
      throw new Error("No region list!");
    }
    instrument.articulation.read(chunks);
    for (let i = 0; i < regions; i++) {
      const chunk2 = RIFFChunk.read(regionListChunk.data);
      this.verifyHeader(chunk2, "LIST");
      const type = readBinaryStringIndexed(chunk2.data, 4);
      if (type !== "rgn " && type !== "rgn2") {
        SpessaLog.groupEnd();
        this.parsingError(`Invalid DLS region! Expected "rgn " or "rgn2" got "${type}"`);
      }
      const region = DownloadableSoundsRegion.read(samples, chunk2);
      if (region) instrument.regions.push(region);
    }
    SpessaLog.groupEnd();
    return instrument;
  }
  static fromSFPreset(preset, samples) {
    const instrument = new DownloadableSoundsInstrument2();
    instrument.name = preset.name;
    instrument.bankLSB = preset.bankLSB;
    instrument.bankMSB = preset.bankMSB;
    instrument.program = preset.program;
    instrument.isGMGSDrum = preset.isGMGSDrum;
    SpessaLog.group(`%cConverting %c${preset.toString()}%c to DLS...`, ConsoleColors.info, ConsoleColors.value, ConsoleColors.info);
    const inst = preset.toFlattenedInstrument();
    for (const z of inst.zones) instrument.regions.push(DownloadableSoundsRegion.fromSFZone(z, samples));
    SpessaLog.groupEnd();
    return instrument;
  }
  write() {
    SpessaLog.groupCollapsed(`%cWriting %c${this.name}%c...`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info);
    const chunks = [this.writeHeader()];
    const regionChunks = this.regions.flatMap((r) => r.write());
    chunks.push(...RIFFChunk.getParts("lrgn", regionChunks, true));
    if (this.articulation.length > 0) chunks.push(...this.articulation.write());
    const inam = RIFFChunk.write("INAM", getStringBytes(this.name, true));
    chunks.push(RIFFChunk.write("INFO", inam, false, true));
    SpessaLog.groupEnd();
    return RIFFChunk.writeParts("ins ", chunks, true);
  }
  /**
  * Performs the full DLS to SF2 instrument conversion.
  */
  toSFPreset(soundBank) {
    const preset = new BasicPreset(soundBank);
    preset.name = this.name;
    preset.bankMSB = this.bankMSB;
    preset.bankLSB = this.bankLSB;
    preset.isGMGSDrum = this.isGMGSDrum;
    preset.program = this.program;
    const instrument = new BasicInstrument();
    instrument.name = this.name;
    preset.createZone(instrument);
    this.articulation.toSFZone(instrument.globalZone);
    for (const region of this.regions) region.toSFZone(instrument, soundBank.samples);
    instrument.globalize();
    if (!instrument.globalZone.modulators.some((m) => m.destination === GeneratorTypes.reverbEffectsSend)) instrument.globalZone.addModulators(Modulator.copyFrom(DEFAULT_DLS_REVERB));
    if (!instrument.globalZone.modulators.some((m) => m.destination === GeneratorTypes.chorusEffectsSend)) instrument.globalZone.addModulators(Modulator.copyFrom(DEFAULT_DLS_CHORUS));
    instrument.globalZone.generators = instrument.globalZone.generators.filter((g) => g.value !== GeneratorLimits[g.type].def);
    soundBank.addPresets(preset);
    soundBank.addInstruments(instrument);
  }
  writeHeader() {
    const inshData = new IndexedByteArray(12);
    writeDword(inshData, this.regions.length);
    let ulBank = (this.bankMSB & 127) << 8 | this.bankLSB & 127;
    if (this.isGMGSDrum) ulBank |= 1 << 31;
    writeDword(inshData, ulBank);
    writeDword(inshData, this.program & 127);
    return RIFFChunk.write("insh", inshData);
  }
};
var DEFAULT_DLS_OPTIONS = { software: "SpessaSynth" };
var DownloadableSounds = class DownloadableSounds2 extends DLSVerifier {
  samples = new Array();
  instruments = new Array();
  soundBankInfo = {
    name: "Unnamed DLS sound bank",
    creationDate: /* @__PURE__ */ new Date(),
    software: "SpessaSynth",
    soundEngine: "DLS Level 2.2",
    product: "SpessaSynth DLS",
    version: {
      major: 2,
      minor: 4
    }
  };
  static read(buffer) {
    if (!buffer) throw new Error("No data provided!");
    const dataArray = new IndexedByteArray(buffer);
    SpessaLog.group("%cParsing DLS file...", ConsoleColors.info);
    const firstChunk = RIFFChunk.read(dataArray, false);
    this.verifyHeader(firstChunk, "RIFF");
    this.verifyText(readBinaryStringIndexed(dataArray, 4).toLowerCase(), "dls ");
    const chunks = [];
    while (dataArray.currentIndex < dataArray.length) chunks.push(RIFFChunk.read(dataArray));
    const dls = new DownloadableSounds2();
    const infoChunk = RIFFChunk.findListType(chunks, "INFO");
    if (infoChunk) while (infoChunk.data.currentIndex < infoChunk.data.length) {
      const infoPart = RIFFChunk.read(infoChunk.data);
      const headerTyped = infoPart.header;
      const text = readBinaryStringIndexed(infoPart.data, infoPart.size);
      switch (headerTyped) {
        case "INAM":
          dls.soundBankInfo.name = text;
          break;
        case "ICRD":
          dls.soundBankInfo.creationDate = parseDateString(text);
          break;
        case "ICMT":
          dls.soundBankInfo.comment = text;
          break;
        case "ISBJ":
          dls.soundBankInfo.subject = text;
          break;
        case "ICOP":
          dls.soundBankInfo.copyright = text;
          break;
        case "IENG":
          dls.soundBankInfo.engineer = text;
          break;
        case "IPRD":
          dls.soundBankInfo.product = text;
          break;
        case "ISFT":
          dls.soundBankInfo.software = text;
      }
    }
    this.printInfo(dls);
    const colhChunk = chunks.find((c) => c.header === "colh");
    if (!colhChunk) {
      this.parsingError("No colh chunk!");
      return 5;
    }
    const instrumentAmount = readLittleEndianIndexed(colhChunk.data, 4);
    SpessaLog.info(`%cInstruments amount: %c${instrumentAmount}`, ConsoleColors.info, ConsoleColors.recognized);
    const waveListChunk = RIFFChunk.findListType(chunks, "wvpl");
    if (!waveListChunk) {
      this.parsingError("No wvpl chunk!");
      return 5;
    }
    const waveList = this.verifyAndReadList(waveListChunk, "wvpl");
    for (const wave of waveList) dls.samples.push(DownloadableSoundsSample.read(wave));
    const instrumentListChunk = RIFFChunk.findListType(chunks, "lins");
    if (!instrumentListChunk) {
      this.parsingError("No lins chunk!");
      return 5;
    }
    const instruments = this.verifyAndReadList(instrumentListChunk, "lins");
    SpessaLog.groupCollapsed("%cLoading instruments...", ConsoleColors.info);
    if (instruments.length !== instrumentAmount) SpessaLog.warn(`Colh reported invalid amount of instruments. Detected ${instruments.length}, expected ${instrumentAmount}`);
    for (const ins of instruments) dls.instruments.push(DownloadableSoundsInstrument.read(dls.samples, ins));
    SpessaLog.groupEnd();
    const aliasingChunk = chunks.find((c) => c.header === "pgal");
    if (aliasingChunk) {
      SpessaLog.info("%cFound the instrument aliasing chunk!", ConsoleColors.recognized);
      const pgalData = aliasingChunk.data;
      if (pgalData[0] !== 0 || pgalData[1] !== 1 || pgalData[2] !== 2 || pgalData[3] !== 3) pgalData.currentIndex += 4;
      const drumInstrument = dls.instruments.find((i) => BankSelectHacks.isXGDrum(i.bankMSB) || i.isGMGSDrum);
      if (!drumInstrument) {
        SpessaLog.warn("MobileBAE aliasing chunk without a drum preset. Aborting!");
        return dls;
      }
      const drumAliases = pgalData.slice(pgalData.currentIndex, pgalData.currentIndex + 128);
      pgalData.currentIndex += 128;
      for (let keyNum = 0; keyNum < 128; keyNum++) {
        const alias = drumAliases[keyNum];
        if (alias === keyNum) continue;
        const region = drumInstrument.regions.find((r) => r.keyRange.max === alias && r.keyRange.min === alias);
        if (!region) {
          SpessaLog.warn(`Invalid drum alias ${keyNum} to ${alias}: region does not exist.`);
          continue;
        }
        const copied = DownloadableSoundsRegion.copyFrom(region);
        copied.keyRange.max = keyNum;
        copied.keyRange.min = keyNum;
        drumInstrument.regions.push(copied);
      }
      pgalData.currentIndex += 4;
      while (pgalData.currentIndex < pgalData.length) {
        const aliasBankNum = readLittleEndianIndexed(pgalData, 2);
        const aliasBankLSB = aliasBankNum & 127;
        const aliasBankMSB = aliasBankNum >> 7 & 127;
        const aliasProgram = pgalData[pgalData.currentIndex++];
        let nullByte = pgalData[pgalData.currentIndex++];
        if (nullByte !== 0) SpessaLog.warn(`Invalid alias byte. Expected 0, got ${nullByte}`);
        const inputBankNum = readLittleEndianIndexed(pgalData, 2);
        const inputBankLSB = inputBankNum & 127;
        const inputBankMSB = inputBankNum >> 7 & 127;
        const inputProgram = pgalData[pgalData.currentIndex++];
        nullByte = pgalData[pgalData.currentIndex++];
        if (nullByte !== 0) SpessaLog.warn(`Invalid alias header. Expected 0, got ${nullByte}`);
        const inputInstrument = dls.instruments.find((inst) => inst.bankLSB === inputBankLSB && inst.bankMSB === inputBankMSB && inst.program === inputProgram && !inst.isGMGSDrum);
        if (!inputInstrument) {
          SpessaLog.warn(`Invalid alias. Missing instrument: ${inputBankLSB}:${inputBankMSB}:${inputProgram}`);
          continue;
        }
        const alias = DownloadableSoundsInstrument.copyFrom(inputInstrument);
        alias.bankMSB = aliasBankMSB;
        alias.bankLSB = aliasBankLSB;
        alias.program = aliasProgram;
        dls.instruments.push(alias);
      }
    }
    SpessaLog.info(`%cParsing finished! %c"${dls.soundBankInfo.name || "UNNAMED"}"%c has %c${dls.instruments.length}%c instruments and %c${dls.samples.length}%c samples.`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info);
    SpessaLog.groupEnd();
    return dls;
  }
  /**
  * Performs a full conversion from BasicSoundBank to DownloadableSounds.
  * Includes an optional progress function for transforming the samples.
  */
  static fromSF(bank, progressFunc) {
    SpessaLog.groupCollapsed("%cSaving SF2 to DLS level 2...", ConsoleColors.info);
    const dls = new DownloadableSounds2();
    dls.soundBankInfo = { ...bank.soundBankInfo };
    for (let i = 0; i < bank.samples.length; i++) {
      const s = bank.samples[i];
      dls.samples.push(DownloadableSoundsSample.fromSFSample(s));
      progressFunc?.(i / bank.samples.length);
    }
    for (const p of bank.presets) dls.instruments.push(DownloadableSoundsInstrument.fromSFPreset(p, bank.samples));
    SpessaLog.info("%cConversion complete!", ConsoleColors.recognized);
    SpessaLog.groupEnd();
    return dls;
  }
  static printInfo(dls) {
    for (const [info, value] of Object.entries(dls.soundBankInfo)) if (typeof value === "object" && "major" in value) {
      const v = value;
      SpessaLog.info(`%c${info}: %c"${v.major}.${v.minor}"`, ConsoleColors.info, ConsoleColors.recognized);
    } else SpessaLog.info(`%c${info}: %c${value.toLocaleString()}`, ConsoleColors.info, ConsoleColors.recognized);
  }
  /**
  * Writes a DLS file.
  * @param writeOptions the options for writing the file.
  */
  write(writeOptions = DEFAULT_DLS_OPTIONS) {
    const options = fillWithDefaults(writeOptions, DEFAULT_DLS_OPTIONS);
    SpessaLog.groupCollapsed("%cSaving DLS...", ConsoleColors.info);
    const colhNum = new IndexedByteArray(4);
    writeDword(colhNum, this.instruments.length);
    const colh = RIFFChunk.write("colh", colhNum);
    SpessaLog.groupCollapsed("%cWriting instruments...", ConsoleColors.info);
    const lins = RIFFChunk.getParts("lins", this.instruments.map((i) => i.write()), true);
    SpessaLog.info("%cSuccess!", ConsoleColors.recognized);
    SpessaLog.groupEnd();
    SpessaLog.groupCollapsed("%cWriting WAVE samples...", ConsoleColors.info);
    let currentIndex = 0;
    const ptblOffsets = [];
    const samples = [];
    let written = 0;
    for (const s of this.samples) {
      const out2 = s.write();
      options.progressFunction?.(written / this.samples.length);
      SpessaLog.info(`%cWrote sample %c${written}. ${s.name}%c of %c${this.samples.length}.`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized);
      ptblOffsets.push(currentIndex);
      currentIndex += out2.reduce((sum, cur) => sum + cur.length, 0);
      samples.push(...out2);
      written++;
    }
    const wvpl = RIFFChunk.getParts("wvpl", samples, true);
    SpessaLog.info("%cSucceeded!", ConsoleColors.recognized);
    const ptblData = new IndexedByteArray(8 + 4 * ptblOffsets.length);
    writeDword(ptblData, 8);
    writeDword(ptblData, ptblOffsets.length);
    for (const offset of ptblOffsets) writeDword(ptblData, offset);
    const ptbl = RIFFChunk.write("ptbl", ptblData);
    this.soundBankInfo.software = options.software;
    const infos = [];
    const info = this.soundBankInfo;
    const writeDLSInfo = (type, data) => {
      if (!data) return;
      infos.push(...RIFFChunk.getParts(type, [getStringBytes(data, true)]));
    };
    writeDLSInfo("INAM", info.name);
    writeDLSInfo("ICMT", info.comment);
    writeDLSInfo("ICOP", info.copyright);
    writeDLSInfo("ICRD", toISODateString(info.creationDate));
    writeDLSInfo("IENG", info.engineer);
    writeDLSInfo("IPRD", info.product);
    writeDLSInfo("ISFT", options.software);
    writeDLSInfo("ISBJ", info.subject);
    SpessaLog.info("%cCombining everything...");
    const out = RIFFChunk.writeParts("RIFF", [
      getStringBytes("DLS "),
      colh,
      ...lins,
      ptbl,
      ...wvpl,
      ...RIFFChunk.getParts("INFO", infos, true)
    ]);
    SpessaLog.info("%cSaved successfully!", ConsoleColors.recognized);
    SpessaLog.groupEnd();
    return out.buffer;
  }
  /**
  * Performs a full conversion from DownloadableSounds to BasicSoundBank.
  */
  toSF() {
    SpessaLog.group("%cConverting DLS to SF2...", ConsoleColors.info);
    const soundBank = new BasicSoundBank("dls");
    soundBank.soundBankInfo.version.minor = 4;
    soundBank.soundBankInfo.version.major = 2;
    soundBank.soundBankInfo = { ...this.soundBankInfo };
    for (const sample of this.samples) sample.toSFSample(soundBank);
    for (const instrument of this.instruments) instrument.toSFPreset(soundBank);
    soundBank.flush();
    SpessaLog.info("%cConversion complete!", ConsoleColors.recognized);
    SpessaLog.groupEnd();
    return soundBank;
  }
};
var BasicSoundBank = class BasicSoundBank2 {
  /**
  * Indicates if the SF3/SF2Pack decoder is ready.
  */
  static isSF3DecoderReady = stb.isInitialized;
  /**
  * The type of the sound bank that was loaded.
  * Either `sf2` for SoundFont2/SoundFont3 or `dls` for DownLoadable Sounds.
  *
  * Please note that SF3 or SFOGG files are parsed as `sf2` files, but with compressed samples.
  * The type is still `sf2`.
  */
  type;
  /**
  * Sound bank's info.
  */
  soundBankInfo = {
    name: "Unnamed",
    creationDate: /* @__PURE__ */ new Date(),
    software: "SpessaSynth",
    soundEngine: "E-mu 10K2",
    version: {
      major: 2,
      minor: 4
    }
  };
  /**
  * The sound bank's presets.
  */
  presets = [];
  /**
  * The sound bank's samples.
  */
  samples = [];
  /**
  * The sound bank's instruments.
  */
  instruments = [];
  /**
  * Sound bank's default modulators.
  */
  defaultModulators = SPESSASYNTH_DEFAULT_MODULATORS.map(Modulator.copyFrom.bind(Modulator));
  /**
  * If the sound bank has custom default modulators (DMOD).
  */
  customDefaultModulators = false;
  constructor(type = "sf2") {
    this.type = type;
  }
  _isXGBank = false;
  /**
  * Checks for XG drum sets and considers if this sound bank is XG.
  */
  get isXGBank() {
    return this._isXGBank;
  }
  /**
  * Merges sound banks with the given order. Keep in mind that the info read is copied from the first one
  * @param soundBanks the sound banks to merge, the first overwrites the last
  */
  static mergeSoundBanks(...soundBanks) {
    const mainSf = soundBanks.shift();
    if (!mainSf) throw new Error("No sound banks provided!");
    const presets = mainSf.presets;
    while (soundBanks.length > 0) {
      const newPresets = soundBanks?.shift()?.presets;
      if (newPresets) {
        for (const newPreset of newPresets) if (!presets.some((existingPreset) => newPreset.matches(existingPreset))) presets.push(newPreset);
      }
    }
    const b = new BasicSoundBank2();
    b.addCompletePresets(presets);
    b.soundBankInfo = { ...mainSf.soundBankInfo };
    return b;
  }
  /**
  * Creates a simple sound bank with one saw wave preset.
  */
  static getSampleSoundBankFile() {
    const font = new BasicSoundBank2();
    const sampleData = new Float32Array(128);
    for (let i = 0; i < 128; i++) sampleData[i] = i / 128 * 2 - 1;
    const sample = new EmptySample();
    sample.name = "Saw";
    sample.originalKey = 65;
    sample.pitchCorrection = 20;
    sample.loopEnd = 127;
    sample.setAudioData(sampleData, 44100);
    font.addSamples(sample);
    const inst = new BasicInstrument();
    inst.name = "Saw Wave";
    inst.globalZone.addGenerators(new Generator(GeneratorTypes.initialAttenuation, 375), new Generator(GeneratorTypes.releaseVolEnv, -1e3), new Generator(GeneratorTypes.sampleModes, 1));
    inst.createZone(sample);
    inst.createZone(sample).setGenerator(GeneratorTypes.fineTune, -9);
    font.addInstruments(inst);
    const preset = new BasicPreset(font);
    preset.name = "Saw Wave";
    preset.createZone(inst);
    font.addPresets(preset);
    font.soundBankInfo.name = "Dummy";
    font.flush();
    return font.writeSF2();
  }
  /**
  * Copies a given sound bank.
  * @param bank The sound bank to copy.
  */
  static copyFrom(bank) {
    const copied = new BasicSoundBank2();
    for (const p of bank.presets) copied.clonePreset(p);
    copied.soundBankInfo = { ...bank.soundBankInfo };
    return copied;
  }
  /**
  * Adds complete presets along with their instruments and samples.
  * @param presets The presets to add.
  */
  addCompletePresets(presets) {
    this.addPresets(...presets);
    const instrumentList = [];
    for (const preset of presets) for (const zone of preset.zones) if (zone.instrument && !instrumentList.includes(zone.instrument)) instrumentList.push(zone.instrument);
    this.addInstruments(...instrumentList);
    const sampleList = [];
    for (const instrument of instrumentList) for (const zone of instrument.zones) if (zone.sample && !sampleList.includes(zone.sample)) sampleList.push(zone.sample);
    this.addSamples(...sampleList);
  }
  /**
  * Sets the sound bank's sample format _in place_.
  * @param options options for writing the file.
  */
  async setSampleFormat(options) {
    let writtenCount = 0;
    const format = options.format;
    const progressFunc = options.progressFunction;
    for (const s of this.samples) {
      switch (format) {
        default:
        case "pcm":
          s.setAudioData(s.getAudioData(), s.sampleRate);
          break;
        case "compressed": {
          const f = options.compressionFunction;
          if (!f) throw new Error(`No compression function supplied but '${format}' was requested.`);
          await s.compressSample(f);
        }
      }
      writtenCount++;
      progressFunc?.(writtenCount / this.samples.length);
      SpessaLog.info(`%cEncoded sample %c${writtenCount}. ${s.name}%c of %c${this.samples.length}%c. Compressed: %c${s.isCompressed}%c.`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, s.isCompressed ? ConsoleColors.recognized : ConsoleColors.unrecognized, ConsoleColors.info);
    }
    switch (format) {
      default:
      case "pcm":
        this.soundBankInfo.version.major = 2;
        this.soundBankInfo.version.minor = 4;
        break;
      case "compressed":
        this.soundBankInfo.version.major = 3;
        this.soundBankInfo.version.minor = 0;
    }
  }
  /**
  * Write the sound bank as a .dls file. This may not be 100% accurate.
  * Note that samples are always written in the s16le PCM encoding.
  * @param options options for writing the file.
  * @returns the binary file.
  */
  writeDLS(options = DEFAULT_DLS_OPTIONS) {
    const pFunc = options.progressFunction;
    return DownloadableSounds.fromSF(this, pFunc ? (p) => pFunc(p / 2) : void 0).write({
      ...options,
      progressFunction: pFunc ? (p) => pFunc(0.5 + p / 2) : void 0
    });
  }
  /**
  * Writes the sound bank as an SF2 file.
  * @param writeOptions the options for writing.
  * @returns the binary file data.
  */
  writeSF2(writeOptions = DEFAULT_SF2_WRITE_OPTIONS) {
    return writeSF2Internal(this, writeOptions);
  }
  addPresets(...presets) {
    this.presets.push(...presets);
  }
  addInstruments(...instruments) {
    this.instruments.push(...instruments);
  }
  addSamples(...samples) {
    this.samples.push(...samples);
  }
  /**
  * Clones a sample into this bank.
  * @param sample The sample to copy.
  * @returns the copied sample, if a sample exists with that name, it is returned instead
  */
  cloneSample(sample) {
    const duplicate = this.samples.find((s) => s.name === sample.name);
    if (duplicate) return duplicate;
    const newSample = new BasicSample(sample.name, sample.sampleRate, sample.originalKey, sample.pitchCorrection, sample.sampleType, sample.loopStart, sample.loopEnd);
    if (sample.isCompressed) newSample.setCompressedData(sample.getRawData(true));
    else newSample.setAudioData(sample.getAudioData(), sample.sampleRate);
    this.addSamples(newSample);
    if (sample.linkedSample) {
      const clonedLinked = this.cloneSample(sample.linkedSample);
      if (!clonedLinked.linkedSample) newSample.setLinkedSample(clonedLinked, newSample.sampleType);
    }
    return newSample;
  }
  /**
  * Recursively clones an instrument into this sound bank, as well as its samples.
  * @returns the copied instrument, if an instrument exists with that name, it is returned instead.
  */
  cloneInstrument(instrument) {
    const duplicate = this.instruments.find((i) => i.name === instrument.name);
    if (duplicate) return duplicate;
    const newInstrument = new BasicInstrument();
    newInstrument.name = instrument.name;
    newInstrument.globalZone.copyFrom(instrument.globalZone);
    for (const zone of instrument.zones) newInstrument.createZone(this.cloneSample(zone.sample)).copyFrom(zone);
    this.addInstruments(newInstrument);
    return newInstrument;
  }
  /**
  * Recursively clones a preset into this sound bank, as well as its instruments and samples.
  * @returns the copied preset, if a preset exists with that name, it is returned instead.
  */
  clonePreset(preset) {
    const duplicate = this.presets.find((p) => p.name === preset.name);
    if (duplicate) return duplicate;
    const newPreset = new BasicPreset(this);
    newPreset.name = preset.name;
    newPreset.bankMSB = preset.bankMSB;
    newPreset.bankLSB = preset.bankLSB;
    newPreset.isGMGSDrum = preset.isGMGSDrum;
    newPreset.program = preset.program;
    newPreset.library = preset.library;
    newPreset.genre = preset.genre;
    newPreset.morphology = preset.morphology;
    newPreset.globalZone.copyFrom(preset.globalZone);
    for (const zone of preset.zones) newPreset.createZone(this.cloneInstrument(zone.instrument)).copyFrom(zone);
    this.addPresets(newPreset);
    return newPreset;
  }
  /**
  * Updates internal values.
  */
  flush() {
    this.presets.sort(MIDIPatchTools.compare.bind(MIDIPatchTools));
    this.parseInternal();
  }
  /**
  * Trims the sound bank _in-place_ to only contain samples in a given MIDI file.
  * @param presetData - A `Map`: `BasicPreset` -> `Set<"key-velocity">`.
  * Absent presets will be removed from the sound bank,
  * and samples that don't get activated in the remaining presets will be removed as well.
  */
  trim(presetData) {
    const trimInstrumentZones = (instrument, keyCombos) => {
      let trimmedIZones = 0;
      for (let iZoneIndex = 0; iZoneIndex < instrument.zones.length; iZoneIndex++) {
        const iZone = instrument.zones[iZoneIndex];
        const iKeyRange = iZone.keyRange;
        const iVelRange = iZone.velRange;
        let isIZoneUsed = false;
        for (const [key, velocities] of keyCombos) if (key >= iKeyRange.min && key <= iKeyRange.max && [...velocities].some((velocity) => velocity >= iVelRange.min && velocity <= iVelRange.max)) {
          isIZoneUsed = true;
          break;
        }
        if (!isIZoneUsed) {
          SpessaLog.info(`%c${iZone.sample.name}%c removed from %c${instrument.name}%c.`, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info);
          if (instrument.deleteZone(iZoneIndex)) {
            trimmedIZones++;
            iZoneIndex--;
            SpessaLog.info(`%c${iZone.sample.name}%c deleted`, ConsoleColors.recognized, ConsoleColors.info);
          }
          if (iZone.sample.useCount < 1) this.deleteSample(iZone.sample);
        }
      }
      return trimmedIZones;
    };
    SpessaLog.groupCollapsed("%cTrimming sound bank...", ConsoleColors.info);
    SpessaLog.info("Combinations to trim for:", presetData);
    for (let presetIndex = 0; presetIndex < this.presets.length; presetIndex++) {
      const p = this.presets[presetIndex];
      const keyCombos = presetData.get(p);
      if (keyCombos === void 0) {
        SpessaLog.info(`%cDeleting preset %c${p.name}%c and its zones`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info);
        this.deletePreset(p);
        presetIndex--;
      } else {
        SpessaLog.groupCollapsed(`%cTrimming %c${p.name}`, ConsoleColors.info, ConsoleColors.recognized);
        SpessaLog.info(`Keys for ${p.name}:`, keyCombos);
        let trimmedZones = 0;
        for (let zoneIndex = 0; zoneIndex < p.zones.length; zoneIndex++) {
          const zone = p.zones[zoneIndex];
          const keyRange = zone.keyRange;
          const velRange = zone.velRange;
          let isZoneUsed = false;
          for (const [key, velocities] of keyCombos) if (key >= keyRange.min && key <= keyRange.max && [...velocities].some((velocity) => velocity >= velRange.min && velocity <= velRange.max)) {
            isZoneUsed = true;
            const trimmedIZones = trimInstrumentZones(zone.instrument, keyCombos);
            SpessaLog.info(`%cTrimmed off %c${trimmedIZones}%c instrument zones from %c${zone.instrument.name}`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized);
            break;
          }
          if (!isZoneUsed) {
            trimmedZones++;
            p.deleteZone(zoneIndex);
            if (zone.instrument.useCount < 1) this.deleteInstrument(zone.instrument);
            zoneIndex--;
          }
        }
        SpessaLog.info(`%cTrimmed off %c${trimmedZones}%c preset zones from %c${p.name}`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized);
        SpessaLog.groupEnd();
      }
    }
    this.removeUnusedElements();
    SpessaLog.info("%cSound bank modified!", ConsoleColors.recognized);
    SpessaLog.groupEnd();
  }
  removeUnusedElements() {
    this.instruments = this.instruments.filter((i) => {
      i.deleteUnusedZones();
      const deletable = i.useCount < 1;
      if (deletable) i.delete();
      return !deletable;
    });
    this.samples = this.samples.filter((s) => {
      const deletable = s.useCount < 1;
      if (deletable) s.unlinkSample();
      return !deletable;
    });
  }
  deleteInstrument(instrument) {
    instrument.delete();
    this.instruments.splice(this.instruments.indexOf(instrument), 1);
  }
  deletePreset(preset) {
    preset.delete();
    this.presets.splice(this.presets.indexOf(preset), 1);
  }
  deleteSample(sample) {
    sample.unlinkSample();
    this.samples.splice(this.samples.indexOf(sample), 1);
  }
  /**
  * Get the appropriate preset.
  */
  getPreset(patch, system) {
    return MIDIPatchTools.selectPatch(this.presets, patch, system);
  }
  destroySoundBank() {
    this.presets.length = 0;
    this.instruments.length = 0;
    this.samples.length = 0;
  }
  parsingError(error) {
    throw new Error(`SF parsing error: ${error} The file may be corrupted.`);
  }
  /**
  * Parses the bank after loading is done
  * @protected
  */
  parseInternal() {
    this._isXGBank = false;
    const allowedPrograms = /* @__PURE__ */ new Set([
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      16,
      17,
      24,
      25,
      26,
      27,
      28,
      29,
      30,
      31,
      32,
      33,
      40,
      41,
      48,
      56,
      57,
      58,
      64,
      65,
      66,
      126,
      127
    ]);
    for (const preset of this.presets) if (BankSelectHacks.isXGDrum(preset.bankMSB)) {
      this._isXGBank = true;
      if (!allowedPrograms.has(preset.program)) {
        this._isXGBank = false;
        SpessaLog.info(`%cThis bank is not valid XG. Preset %c${preset.toString()}%c is not a valid XG drum. XG mode will use presets on bank 128.`, ConsoleColors.info, ConsoleColors.value, ConsoleColors.info);
        break;
      }
    }
  }
  printInfo() {
    for (const [info, value] of Object.entries(this.soundBankInfo)) if (typeof value === "object" && "major" in value) {
      const v = value;
      SpessaLog.info(`%c${info}: %c"${v.major}.${v.minor}"`, ConsoleColors.info, ConsoleColors.recognized);
    } else SpessaLog.info(`%c${info}: %c${value.toLocaleString()}`, ConsoleColors.info, ConsoleColors.recognized);
  }
};
var ReadGenerator = class extends Generator {
  /**
  * Creates a generator
  */
  constructor(dataArray) {
    const i = dataArray.currentIndex;
    const generatorType = dataArray[i + 1] << 8 | dataArray[i];
    const generatorValue = signedInt16(dataArray[i + 2], dataArray[i + 3]);
    dataArray.currentIndex += 4;
    super(generatorType, generatorValue, false);
  }
};
function readGenerators(generatorChunk) {
  const gens = [];
  while (generatorChunk.data.length > generatorChunk.data.currentIndex) gens.push(new ReadGenerator(generatorChunk.data));
  gens.pop();
  return gens;
}
function applyPresetZones(indexes, presetGens, presetMods, instruments, presets) {
  const genStartIndexes = indexes.gen;
  const modStartIndexes = indexes.mod;
  let modIndex = 0;
  let genIndex = 0;
  for (const preset of presets) for (let i = 0; i < preset.zonesCount; i++) {
    const gensStart = genStartIndexes[genIndex++];
    const gensEnd = genStartIndexes[genIndex];
    const gens = presetGens.slice(gensStart, gensEnd);
    const modsStart = modStartIndexes[modIndex++];
    const modsEnd = modStartIndexes[modIndex];
    const mods = presetMods.slice(modsStart, modsEnd);
    if (gens.some((g) => g.type === GeneratorTypes.instrument)) preset.createSoundFontZone(mods, gens, instruments);
    else {
      preset.globalZone.addGenerators(...gens);
      preset.globalZone.addModulators(...mods);
    }
  }
}
var SoundFontPreset = class extends BasicPreset {
  zoneStartIndex;
  zonesCount = 0;
  /**
  * Creates a preset
  */
  constructor(presetChunk, sf2) {
    super(sf2);
    this.name = readBinaryStringIndexed(presetChunk.data, 20);
    this.program = readLittleEndianIndexed(presetChunk.data, 2);
    const wBank = readLittleEndianIndexed(presetChunk.data, 2);
    this.bankMSB = wBank & 127;
    this.isGMGSDrum = (wBank & 128) > 0;
    this.bankLSB = wBank >> 8;
    this.zoneStartIndex = readLittleEndianIndexed(presetChunk.data, 2);
    this.library = readLittleEndianIndexed(presetChunk.data, 4);
    this.genre = readLittleEndianIndexed(presetChunk.data, 4);
    this.morphology = readLittleEndianIndexed(presetChunk.data, 4);
  }
  createSoundFontZone(modulators, generators, instruments) {
    const instrumentID = generators.find((g) => g.type === GeneratorTypes.instrument);
    let instrument;
    if (instrumentID) instrument = instruments[instrumentID.value];
    else throw new Error("No instrument ID found in preset zone.");
    if (!instrument) throw new Error(`Invalid instrument ID: ${instrumentID.value}, available instruments: ${instruments.length}`);
    const z = new BasicPresetZone(this, instrument);
    z.addGenerators(...generators);
    z.addModulators(...modulators);
    this.zones.push(z);
    return z;
  }
};
function readPresets(presetChunk, parent) {
  const presets = [];
  while (presetChunk.data.length > presetChunk.data.currentIndex) {
    const preset = new SoundFontPreset(presetChunk, parent);
    if (presets.length > 0) {
      const previous = presets[presets.length - 1];
      previous.zonesCount = preset.zoneStartIndex - previous.zoneStartIndex;
    }
    presets.push(preset);
  }
  presets.pop();
  return presets;
}
var SoundFontInstrument = class extends BasicInstrument {
  zoneStartIndex;
  zonesCount = 0;
  /**
  * Creates an instrument
  */
  constructor(instrumentChunk) {
    super();
    this.name = readBinaryStringIndexed(instrumentChunk.data, 20);
    this.zoneStartIndex = readLittleEndianIndexed(instrumentChunk.data, 2);
  }
  createSoundFontZone(modulators, generators, samples) {
    const sampleID = generators.find((g) => g.type === GeneratorTypes.sampleID);
    let sample;
    if (sampleID) sample = samples[sampleID.value];
    else throw new Error("No sample ID found in instrument zone.");
    if (!sample) throw new Error(`Invalid sample ID: ${sampleID.value}, available samples: ${samples.length}`);
    const z = new BasicInstrumentZone(this, sample);
    z.addGenerators(...generators);
    z.addModulators(...modulators);
    this.zones.push(z);
    return z;
  }
};
function readInstruments(instrumentChunk) {
  const instruments = [];
  while (instrumentChunk.data.length > instrumentChunk.data.currentIndex) {
    const instrument = new SoundFontInstrument(instrumentChunk);
    if (instruments.length > 0) {
      const previous = instruments[instruments.length - 1];
      previous.zonesCount = instrument.zoneStartIndex - previous.zoneStartIndex;
    }
    instruments.push(instrument);
  }
  instruments.pop();
  return instruments;
}
function readModulators(modulatorChunk) {
  const mods = [];
  while (modulatorChunk.data.length > modulatorChunk.data.currentIndex) {
    const dataArray = modulatorChunk.data;
    const sourceEnum = readLittleEndianIndexed(dataArray, 2);
    const destination = readLittleEndianIndexed(dataArray, 2);
    const amount = signedInt16(dataArray[dataArray.currentIndex++], dataArray[dataArray.currentIndex++]);
    const secondarySourceEnum = readLittleEndianIndexed(dataArray, 2);
    const transformType = readLittleEndianIndexed(dataArray, 2);
    mods.push(new DecodedModulator(sourceEnum, secondarySourceEnum, destination, amount, transformType));
  }
  mods.pop();
  return mods;
}
function applyInstrumentZones(indexes, instrumentGenerators, instrumentModulators, samples, instruments) {
  const genStartIndexes = indexes.gen;
  const modStartIndexes = indexes.mod;
  let modIndex = 0;
  let genIndex = 0;
  for (const instrument of instruments) for (let i = 0; i < instrument.zonesCount; i++) {
    const gensStart = genStartIndexes[genIndex++];
    const gensEnd = genStartIndexes[genIndex];
    const gens = instrumentGenerators.slice(gensStart, gensEnd);
    const modsStart = modStartIndexes[modIndex++];
    const modsEnd = modStartIndexes[modIndex];
    const mods = instrumentModulators.slice(modsStart, modsEnd);
    if (gens.some((g) => g.type === GeneratorTypes.sampleID)) instrument.createSoundFontZone(mods, gens, samples);
    else {
      instrument.globalZone.addGenerators(...gens);
      instrument.globalZone.addModulators(...mods);
    }
  }
}
function readZoneIndexes(zonesChunk) {
  const modStartIndexes = [];
  const genStartIndexes = [];
  while (zonesChunk.data.length > zonesChunk.data.currentIndex) {
    genStartIndexes.push(readLittleEndianIndexed(zonesChunk.data, 2));
    modStartIndexes.push(readLittleEndianIndexed(zonesChunk.data, 2));
  }
  return {
    mod: modStartIndexes,
    gen: genStartIndexes
  };
}
var SoundFont2 = class extends BasicSoundBank {
  sampleDataStartIndex = 0;
  /**
  * Initializes a new SoundFont2 Parser and parses the given data array
  */
  constructor(arrayBuffer, warnDeprecated = true) {
    super("sf2");
    if (warnDeprecated) throw new Error("Using the constructor directly is deprecated. Use SoundBankLoader.fromArrayBuffer() instead.");
    const mainFileArray = new IndexedByteArray(arrayBuffer);
    SpessaLog.group("%cParsing a SoundFont2 file...", ConsoleColors.info);
    if (!mainFileArray) {
      SpessaLog.groupEnd();
      this.parsingError("No data provided!");
    }
    const firstChunk = RIFFChunk.read(mainFileArray, false);
    this.verifyHeader(firstChunk, "riff");
    const type = readBinaryStringIndexed(mainFileArray, 4).toLowerCase();
    if (type !== "sfbk" && type !== "sfpk") {
      SpessaLog.groupEnd();
      throw new SyntaxError(`Invalid soundFont! Expected "sfbk" or "sfpk" got "${type}"`);
    }
    const isSF2Pack = type === "sfpk";
    const infoChunk = RIFFChunk.read(mainFileArray);
    this.verifyHeader(infoChunk, "list");
    const infoString = readBinaryStringIndexed(infoChunk.data, 4);
    if (infoString !== "INFO") {
      SpessaLog.groupEnd();
      throw new SyntaxError(`Invalid soundFont! Expected "INFO" got "${infoString}"`);
    }
    let xdtaChunk;
    while (infoChunk.data.length > infoChunk.data.currentIndex) {
      const chunk = RIFFChunk.read(infoChunk.data);
      const text = readBinaryString(chunk.data, chunk.data.length);
      const headerTyped = chunk.header;
      switch (headerTyped) {
        case "ifil":
        case "iver": {
          const major = readLittleEndianIndexed(chunk.data, 2);
          const minor = readLittleEndianIndexed(chunk.data, 2);
          if (headerTyped === "ifil") this.soundBankInfo.version = {
            major,
            minor
          };
          else this.soundBankInfo.romVersion = {
            major,
            minor
          };
          break;
        }
        case "DMOD":
          this.defaultModulators = readModulators(chunk);
          this.customDefaultModulators = true;
          break;
        case "LIST":
          if (readBinaryStringIndexed(chunk.data, 4) === "xdta") {
            SpessaLog.info("%cExtended SF2 found!", ConsoleColors.recognized);
            xdtaChunk = chunk;
          }
          break;
        case "ICRD":
          this.soundBankInfo.creationDate = parseDateString(readBinaryStringIndexed(chunk.data, chunk.data.length));
          break;
        case "ISFT":
          this.soundBankInfo.software = text;
          break;
        case "IPRD":
          this.soundBankInfo.product = text;
          break;
        case "IENG":
          this.soundBankInfo.engineer = text;
          break;
        case "ICOP":
          this.soundBankInfo.copyright = text;
          break;
        case "INAM":
          this.soundBankInfo.name = text;
          break;
        case "ICMT":
          this.soundBankInfo.comment = text;
          break;
        case "irom":
          this.soundBankInfo.romInfo = text;
          break;
        case "isng":
          this.soundBankInfo.soundEngine = text;
      }
    }
    this.printInfo();
    const xChunks = {};
    if (xdtaChunk !== void 0) {
      xChunks.phdr = RIFFChunk.read(xdtaChunk.data);
      xChunks.pbag = RIFFChunk.read(xdtaChunk.data);
      xChunks.pmod = RIFFChunk.read(xdtaChunk.data);
      xChunks.pgen = RIFFChunk.read(xdtaChunk.data);
      xChunks.inst = RIFFChunk.read(xdtaChunk.data);
      xChunks.ibag = RIFFChunk.read(xdtaChunk.data);
      xChunks.imod = RIFFChunk.read(xdtaChunk.data);
      xChunks.igen = RIFFChunk.read(xdtaChunk.data);
      xChunks.shdr = RIFFChunk.read(xdtaChunk.data);
    }
    const sdtaChunk = RIFFChunk.read(mainFileArray, false);
    this.verifyHeader(sdtaChunk, "list");
    this.verifyText(readBinaryStringIndexed(mainFileArray, 4), "sdta");
    SpessaLog.info("%cVerifying smpl chunk...", ConsoleColors.warn);
    const sampleDataChunk = RIFFChunk.read(mainFileArray, false);
    this.verifyHeader(sampleDataChunk, "smpl");
    let sampleData;
    if (isSF2Pack) {
      SpessaLog.info("%cSF2Pack detected, attempting to decode the smpl chunk...", ConsoleColors.info);
      try {
        sampleData = stb.decode(mainFileArray.buffer.slice(mainFileArray.currentIndex, mainFileArray.currentIndex + sdtaChunk.size - 12)).data[0];
      } catch (error) {
        SpessaLog.groupEnd();
        throw new Error(`SF2Pack Ogg Vorbis decode error: ${error}`, { cause: error });
      }
      SpessaLog.info(`%cDecoded the smpl chunk! Length: %c${sampleData.length}`, ConsoleColors.info, ConsoleColors.value);
    } else {
      sampleData = mainFileArray;
      this.sampleDataStartIndex = mainFileArray.currentIndex;
    }
    SpessaLog.info(`%cSkipping sample chunk, length: %c${sdtaChunk.size - 12}`, ConsoleColors.info, ConsoleColors.value);
    mainFileArray.currentIndex += sdtaChunk.size - 12;
    SpessaLog.info("%cLoading preset data chunk...", ConsoleColors.warn);
    const presetChunk = RIFFChunk.read(mainFileArray);
    this.verifyHeader(presetChunk, "list");
    readBinaryStringIndexed(presetChunk.data, 4);
    const phdrChunk = RIFFChunk.read(presetChunk.data);
    this.verifyHeader(phdrChunk, "phdr");
    const pbagChunk = RIFFChunk.read(presetChunk.data);
    this.verifyHeader(pbagChunk, "pbag");
    const pmodChunk = RIFFChunk.read(presetChunk.data);
    this.verifyHeader(pmodChunk, "pmod");
    const pgenChunk = RIFFChunk.read(presetChunk.data);
    this.verifyHeader(pgenChunk, "pgen");
    const instChunk = RIFFChunk.read(presetChunk.data);
    this.verifyHeader(instChunk, "inst");
    const ibagChunk = RIFFChunk.read(presetChunk.data);
    this.verifyHeader(ibagChunk, "ibag");
    const imodChunk = RIFFChunk.read(presetChunk.data);
    this.verifyHeader(imodChunk, "imod");
    const igenChunk = RIFFChunk.read(presetChunk.data);
    this.verifyHeader(igenChunk, "igen");
    const shdrChunk = RIFFChunk.read(presetChunk.data);
    this.verifyHeader(shdrChunk, "shdr");
    SpessaLog.info("%cParsing samples...", ConsoleColors.info);
    mainFileArray.currentIndex = this.sampleDataStartIndex;
    const samples = readSamples(shdrChunk, sampleData, xdtaChunk === void 0);
    if (xdtaChunk && xChunks.shdr) {
      const xSamples = readSamples(xChunks.shdr, new Float32Array(1), false);
      if (xSamples.length === samples.length) for (const [i, s] of samples.entries()) {
        s.name += xSamples[i].name;
        s.linkedSampleIndex |= xSamples[i].linkedSampleIndex << 16;
      }
    }
    for (const s of samples) s.name = s.name.trim();
    this.samples.push(...samples);
    const instrumentGenerators = readGenerators(igenChunk);
    const instrumentModulators = readModulators(imodChunk);
    const instruments = readInstruments(instChunk);
    if (xdtaChunk && xChunks.inst) {
      const xInst = readInstruments(xChunks.inst);
      if (xInst.length === instruments.length) {
        for (const [i, inst] of instruments.entries()) {
          inst.name += xInst[i].name;
          inst.zoneStartIndex |= xInst[i].zoneStartIndex << 16;
        }
        for (const [i, inst] of instruments.entries()) if (i < instruments.length - 1) inst.zonesCount = instruments[i + 1].zoneStartIndex - inst.zoneStartIndex;
      }
    }
    for (const i of instruments) i.name = i.name.trim();
    this.instruments.push(...instruments);
    const ibagIndexes = readZoneIndexes(ibagChunk);
    if (xdtaChunk && xChunks.ibag) {
      const extraIndexes = readZoneIndexes(xChunks.ibag);
      for (let i = 0; i < ibagIndexes.mod.length; i++) ibagIndexes.mod[i] |= extraIndexes.mod[i] << 16;
      for (let i = 0; i < ibagIndexes.gen.length; i++) ibagIndexes.gen[i] |= extraIndexes.gen[i] << 16;
    }
    applyInstrumentZones(ibagIndexes, instrumentGenerators, instrumentModulators, this.samples, instruments);
    const presetGenerators = readGenerators(pgenChunk);
    const presetModulators = readModulators(pmodChunk);
    const presets = readPresets(phdrChunk, this);
    if (xdtaChunk && xChunks.phdr) {
      const xPreset = readPresets(xChunks.phdr, this);
      if (xPreset.length === presets.length) {
        for (const [i, pres] of presets.entries()) {
          pres.name += xPreset[i].name;
          pres.zoneStartIndex |= xPreset[i].zoneStartIndex << 16;
        }
        for (const [i, preset] of presets.entries()) if (i < presets.length - 1) preset.zonesCount = presets[i + 1].zoneStartIndex - preset.zoneStartIndex;
      }
    }
    for (const p of presets) p.name = p.name.trim();
    this.addPresets(...presets);
    const pbagIndexes = readZoneIndexes(pbagChunk);
    if (xdtaChunk && xChunks.pbag) {
      const extraIndexes = readZoneIndexes(xChunks.pbag);
      for (let i = 0; i < pbagIndexes.mod.length; i++) pbagIndexes.mod[i] |= extraIndexes.mod[i] << 16;
      for (let i = 0; i < pbagIndexes.gen.length; i++) pbagIndexes.gen[i] |= extraIndexes.gen[i] << 16;
    }
    applyPresetZones(pbagIndexes, presetGenerators, presetModulators, this.instruments, presets);
    this.flush();
    SpessaLog.info(`%cParsing finished! %c"${this.soundBankInfo.name}"%c has %c${this.presets.length}%c presets,
        %c${this.instruments.length}%c instruments and %c${this.samples.length}%c samples.`, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info, ConsoleColors.recognized, ConsoleColors.info);
    SpessaLog.groupEnd();
  }
  verifyHeader(chunk, expected) {
    if (chunk.header.toLowerCase() !== expected.toLowerCase()) {
      SpessaLog.groupEnd();
      this.parsingError(`Invalid chunk header! Expected "${expected.toLowerCase()}" got "${chunk.header.toLowerCase()}"`);
    }
  }
  verifyText(text, expected) {
    if (text.toLowerCase() !== expected.toLowerCase()) {
      SpessaLog.groupEnd();
      this.parsingError(`Invalid FourCC: Expected "${expected.toLowerCase()}" got "${text.toLowerCase()}"\``);
    }
  }
};
var SoundBankLoader = class {
  /**
  * Loads a sound bank from a file buffer.
  * @param buffer The binary file buffer to load.
  * @returns The loaded sound bank, a BasicSoundBank instance.
  */
  static fromArrayBuffer(buffer) {
    if (readBinaryStringIndexed(new IndexedByteArray(buffer.slice(8, 12)), 4).toLowerCase() === "dls ") return this.loadDLS(buffer);
    return new SoundFont2(buffer, false);
  }
  static loadDLS(buffer) {
    return DownloadableSounds.read(buffer).toSF();
  }
};
var VoiceModulator = class VoiceModulator2 extends Modulator {
  /**
  * Indicates if the given modulator is chorus or reverb effects modulator.
  * This is done to simulate BASSMIDI effects behavior:
  * - defaults to 1000 transform amount rather than 200
  * - values can be changed, but anything above 200 is 1000
  * (except for values above 1000, they are copied directly)
  * - all values below are multiplied by 5 (200 * 5 = 1000)
  * - still can be disabled if the soundfont has its own modulator curve
  * - this fixes the very low amount of reverb by default and doesn't break soundfonts
  */
  isEffectModulator;
  /**
  * The default resonant modulator does not affect the filter gain.
  * Neither XG nor GS responded to cc #74 in that way.
  */
  isDefaultResonantModulator;
  /**
  * If this is a modulation wheel modulator (for modulation depth range).
  */
  isModWheelModulator;
  constructor(s1, s2, destination, amount, transformType, isEffectModulator, isDefaultResonantModulator, isModWheelModulator) {
    super(s1, s2, destination, amount, transformType);
    this.isEffectModulator = isEffectModulator;
    this.isDefaultResonantModulator = isDefaultResonantModulator;
    this.isModWheelModulator = isModWheelModulator;
  }
  static fromData(s1, s2, destination, amount, transformType) {
    const s1Enum = s1.toSourceEnum();
    const s2Enum = s2.toSourceEnum();
    return new VoiceModulator2(s1, s2, destination, amount, transformType, (s1Enum === 219 || s1Enum === 221) && s2Enum === 0 && (destination === GeneratorTypes.reverbEffectsSend || destination === GeneratorTypes.chorusEffectsSend), s1Enum === DEFAULT_RESONANT_MOD_SOURCE && s2Enum === 0 && destination === GeneratorTypes.initialFilterQ, (s1.isCC && s1.index === MIDIControllers.modulationWheel || s2.isCC && s2.index === MIDIControllers.modulationWheel) && (destination === GeneratorTypes.modLfoToPitch || destination === GeneratorTypes.vibLfoToPitch));
  }
  static fromModulator(mod) {
    return this.fromData(mod.primarySource, mod.secondarySource, mod.destination, mod.transformAmount, mod.transformType);
  }
};
var CachedVoice = class {
  /**
  * Sample data of this voice.
  */
  sampleData;
  /**
  * The unmodulated (copied to) generators of the voice.
  */
  generators;
  /**
  * The voice's modulators.
  */
  modulators;
  /**
  * Exclusive class number for hi-hats etc.
  */
  exclusiveClass;
  /**
  * Target key of the voice (can be overridden by generators)
  */
  targetKey;
  /**
  * Target velocity of the voice (can be overridden by generators)
  */
  velocity;
  /**
  * MIDI root key of the sample
  */
  rootKey;
  /**
  * Start position of the loop
  */
  loopStart;
  /**
  * End position of the loop
  */
  loopEnd;
  /**
  * Playback step (rate) for sample pitch correction
  */
  playbackStep;
  loopingMode;
  constructor(voiceParams, midiNote, velocity, sampleRate) {
    const sample = voiceParams.sample;
    const generators = voiceParams.generators;
    this.modulators = voiceParams.modulators.map(VoiceModulator.fromModulator.bind(VoiceModulator));
    this.generators = generators;
    this.rootKey = sample.originalKey;
    if (generators[GeneratorTypes.overridingRootKey] > -1) this.rootKey = generators[GeneratorTypes.overridingRootKey];
    this.targetKey = midiNote;
    if (generators[GeneratorTypes.keyNum] > -1) this.targetKey = generators[GeneratorTypes.keyNum];
    this.velocity = velocity;
    if (generators[GeneratorTypes.velocity] > -1) this.velocity = generators[GeneratorTypes.velocity];
    this.exclusiveClass = generators[GeneratorTypes.exclusiveClass];
    this.loopStart = sample.loopStart;
    this.loopEnd = sample.loopEnd;
    this.sampleData = sample.getAudioData();
    this.playbackStep = sample.sampleRate / sampleRate * Math.pow(2, sample.pitchCorrection / 1200);
    this.loopingMode = generators[GeneratorTypes.sampleModes];
  }
};
var HALF_PI$1 = Math.PI / 2;
var MIN_PAN$1 = -500;
var MAX_PAN$1 = 500;
var PAN_RESOLUTION$1 = MAX_PAN$1 - MIN_PAN$1;
var panTableLeft = new Float32Array(PAN_RESOLUTION$1 + 1);
var panTableRight = new Float32Array(PAN_RESOLUTION$1 + 1);
for (let pan = MIN_PAN$1; pan <= MAX_PAN$1; pan++) {
  const realPan = (pan - MIN_PAN$1) / PAN_RESOLUTION$1;
  const tableIndex = pan - MIN_PAN$1;
  panTableLeft[tableIndex] = Math.cos(HALF_PI$1 * realPan);
  panTableRight[tableIndex] = Math.sin(HALF_PI$1 * realPan);
}
function renderVoice(voice, timeNow, outputL, outputR, startIndex, sampleCount) {
  if (!voice.isInRelease && timeNow >= voice.releaseStartTime) {
    voice.isInRelease = true;
    voice.volEnv.startRelease(voice);
    voice.modEnv.startRelease(voice);
    if (voice.loopingMode === 3) voice.wavetable.isLooping = false;
  }
  voice.hasRendered = true;
  if (!voice.isActive) return;
  const core = this.synthCore;
  const sampleRate = core.sampleRate;
  const modulated = voice.modulatedGenerators;
  let targetKey = voice.targetKey;
  let cents = voice.pitchOffset + modulated[GeneratorTypes.fineTune] + this.octaveTuning[targetKey] + this.currentTuning;
  let semitones = modulated[GeneratorTypes.coarseTune];
  const tuning = core.tunings[this.preset.program * 128 + voice.midiNote];
  if (tuning !== -1) {
    targetKey = Math.trunc(tuning);
    semitones += tuning - targetKey;
  }
  if (voice.portamentoFromKey > -1) {
    const elapsed = Math.min((timeNow - voice.startTime) / voice.portamentoDuration, 1);
    const diff = targetKey - voice.portamentoFromKey;
    semitones -= diff * (1 - elapsed);
  }
  cents += (targetKey - voice.rootKey) * modulated[GeneratorTypes.scaleTuning];
  let lowpassExcursion = 0;
  let volumeExcursionCentibels = 0;
  let voiceGain = voice.gainModifier * (1 + modulated[GeneratorTypes.amplitude] / 1e3);
  if (timeNow >= voice.vibLfoStartTime) {
    const vibPitchDepth = modulated[GeneratorTypes.vibLfoToPitch];
    const vibFilterDepth = modulated[GeneratorTypes.vibLfoToFilterFc];
    const vibAmplitudeDepth = modulated[GeneratorTypes.vibLfoAmplitudeDepth];
    if (vibPitchDepth !== 0 || vibFilterDepth !== 0 || vibAmplitudeDepth !== 0) {
      const rateInc = Math.max(0, absCentsToHz(modulated[GeneratorTypes.freqVibLFO]) + modulated[GeneratorTypes.vibLfoRate] / 100) * sampleCount / sampleRate;
      const vibLfoValue = 1 - 4 * Math.abs(voice.vibLfoPhase - 0.5);
      if ((voice.vibLfoPhase += rateInc) >= 1) voice.vibLfoPhase -= 1;
      cents += vibLfoValue * vibPitchDepth;
      lowpassExcursion += vibLfoValue * vibFilterDepth;
      voiceGain *= 1 - (vibLfoValue + 1) / 2 * (vibAmplitudeDepth / 1e3);
    }
  }
  if (timeNow >= voice.modLfoStartTime) {
    const modPitchDepth = modulated[GeneratorTypes.modLfoToPitch];
    const modVolDepth = modulated[GeneratorTypes.modLfoToVolume];
    const modFilterDepth = modulated[GeneratorTypes.modLfoToFilterFc];
    const modAmplitudeDepth = modulated[GeneratorTypes.modLfoAmplitudeDepth];
    if (modPitchDepth !== 0 || modFilterDepth !== 0 || modVolDepth !== 0 || modAmplitudeDepth !== 0) {
      const rateInc = Math.max(0, absCentsToHz(modulated[GeneratorTypes.freqModLFO]) + modulated[GeneratorTypes.modLfoRate] / 100) * sampleCount / sampleRate;
      const modLfoValue = 1 - 4 * Math.abs(voice.modLfoPhase - 0.5);
      if ((voice.modLfoPhase += rateInc) >= 1) voice.modLfoPhase -= 1;
      cents += modLfoValue * modPitchDepth;
      volumeExcursionCentibels += -modLfoValue * modVolDepth;
      lowpassExcursion += modLfoValue * modFilterDepth;
      voiceGain *= 1 - (modLfoValue + 1) / 2 * (modAmplitudeDepth / 1e3);
    }
  }
  const modEnvPitchDepth = modulated[GeneratorTypes.modEnvToPitch];
  const modEnvFilterDepth = modulated[GeneratorTypes.modEnvToFilterFc];
  if (modEnvFilterDepth !== 0 || modEnvPitchDepth !== 0) {
    const modEnv = voice.modEnv.process(voice, timeNow);
    lowpassExcursion += modEnv * modEnvFilterDepth;
    cents += modEnv * modEnvPitchDepth;
  }
  volumeExcursionCentibels -= voice.resonanceOffset;
  const centsTotal = cents + semitones * 100;
  const centsRounded = centsTotal | 0;
  if (centsRounded !== voice.tuningCents) {
    voice.tuningCents = centsRounded;
    voice.tuningRatio = Math.pow(2, centsTotal / 1200);
  }
  const gainTarget = cbAttenuationToGain(modulated[GeneratorTypes.initialAttenuation]) * cbAttenuationToGain(volumeExcursionCentibels);
  if (voice.loopingMode === 2 && !voice.isInRelease) {
    voice.isActive = voice.volEnv.process(sampleCount, gainTarget);
    return;
  }
  const buffer = core.voiceBuffer;
  voice.isActive = voice.wavetable.process(sampleCount, voice.tuningRatio, buffer);
  let gain = voice.volEnv.outputGain;
  const envActive = voice.volEnv.process(sampleCount, gainTarget);
  const gainInc = (voice.volEnv.outputGain - gain) / sampleCount;
  {
    const f = voice.filter;
    const initialFc = modulated[GeneratorTypes.initialFilterFc];
    if (f.initialized) f.currentInitialFc += (initialFc - f.currentInitialFc) * LowpassFilter.smoothingConstant;
    else {
      f.initialized = true;
      f.currentInitialFc = initialFc;
    }
    const targetCutoff = f.currentInitialFc + lowpassExcursion;
    const modulatedResonance = modulated[GeneratorTypes.initialFilterQ];
    if (f.currentInitialFc > 13499 && targetCutoff > 13499 && modulatedResonance === 0) {
      f.currentInitialFc = 13500;
      for (let i = 0; i < sampleCount; i++) {
        buffer[i] *= gain;
        gain += gainInc;
      }
    } else {
      if (Math.abs(f.lastTargetCutoff - targetCutoff) > 1 || f.resonanceCb !== modulatedResonance) {
        f.lastTargetCutoff = targetCutoff;
        f.resonanceCb = modulatedResonance;
        f.calculateCoefficients(targetCutoff);
      }
      const { a0, a1, a2, a3, a4 } = f;
      let { x1, x2, y1, y2 } = f;
      for (let i = 0; i < sampleCount; i++) {
        const input = buffer[i];
        const filtered = a0 * input + a1 * x1 + a2 * x2 - a3 * y1 - y2 * a4;
        x2 = x1;
        x1 = input;
        y2 = y1;
        y1 = filtered;
        buffer[i] = filtered * gain;
        gain += gainInc;
      }
      f.x1 = x1;
      f.x2 = x2;
      f.y1 = y1;
      f.y2 = y2;
    }
  }
  voice.isActive = voice.isActive && envActive;
  let pan;
  if (voice.overridePan) pan = voice.overridePan;
  else {
    voice.currentPan += (modulated[GeneratorTypes.pan] - voice.currentPan) * core.panSmoothingFactor;
    pan = voice.currentPan;
  }
  const { systemParameters } = core;
  const outputGain = this.currentGain * voiceGain;
  const index = Math.min(Math.max(-500, pan + this.currentPan), 500) + 500 | 0;
  const gainLeft = panTableLeft[index] * outputGain;
  const gainRight = panTableRight[index] * outputGain;
  if (this._midiParameters.efxAssign) {
    const insertionL = core.insertionInputL;
    const insertionR = core.insertionInputR;
    for (let i = 0; i < sampleCount; i++) {
      const s = buffer[i];
      insertionL[i] += gainLeft * s;
      insertionR[i] += gainRight * s;
    }
    return;
  }
  for (let i = 0; i < sampleCount; i++) {
    const s = buffer[i];
    const idx = i + startIndex;
    outputL[idx] += gainLeft * s;
    outputR[idx] += gainRight * s;
  }
  if (!systemParameters.effectsEnabled) return;
  const reverbSend = modulated[GeneratorTypes.reverbEffectsSend] * voice.reverbSend;
  if (reverbSend > 0) {
    const reverbGain = systemParameters.reverbGain * outputGain * (reverbSend / 1e3);
    const reverb = core.reverbInput;
    for (let i = 0; i < sampleCount; i++) reverb[i] += reverbGain * buffer[i];
  }
  const chorusSend = modulated[GeneratorTypes.chorusEffectsSend] * voice.chorusSend;
  if (chorusSend > 0) {
    const chorusGain = systemParameters.chorusGain * (chorusSend / 1e3) * outputGain;
    const chorus = core.chorusInput;
    for (let i = 0; i < sampleCount; i++) chorus[i] += chorusGain * buffer[i];
  }
  if (core.delayActive) {
    const delaySend = this._midiControllers[MIDIControllers.variationDepth] * voice.delaySend;
    if (delaySend > 0) {
      const delayGain = outputGain * systemParameters.delayGain * ((delaySend >> 7) / 127);
      const delay = core.delayInput;
      for (let i = 0; i < sampleCount; i++) delay[i] += delayGain * buffer[i];
    }
  }
}
function controllerChange(controller, value, sendEvent = true) {
  if (controller > 127 || value < 0) throw new Error("Invalid MIDI Controller.");
  if (controller >= MIDIControllers.modulationWheelLSB && controller <= MIDIControllers.effectControl2LSB) {
    const actualCCNum = controller - 32;
    if (this.lockedControllers[actualCCNum]) return;
    this._midiControllers[actualCCNum] = this._midiControllers[actualCCNum] & 16256 | value & 127;
    this.computeModulatorsAll(1, actualCCNum);
  }
  if (this.lockedControllers[controller]) return;
  this._midiControllers[controller] = value << 7 | this._midiControllers[controller] & 127;
  switch (controller) {
    case MIDIControllers.omniModeOff:
    case MIDIControllers.omniModeOn:
    case MIDIControllers.allNotesOff:
      this.stopAllNotes();
      break;
    case MIDIControllers.allSoundOff:
      this.stopAllNotes(true);
      break;
    case MIDIControllers.polyModeOn:
      this.stopAllNotes(true);
      this.setMIDIParameter("polyMode", true);
      break;
    case MIDIControllers.monoModeOn:
      this.stopAllNotes(true);
      this.setMIDIParameter("polyMode", false);
      break;
    case MIDIControllers.bankSelect:
      this.setBankMSB(value);
      if (this.channel % 16 === 9 && BankSelectHacks.isSystemXG(this.channelSystem)) this.setBankMSB(127);
      break;
    case MIDIControllers.bankSelectLSB:
      this.setBankLSB(value);
      break;
    case MIDIControllers.variationDepth:
      this.synthCore.delayActive = true;
      break;
    case MIDIControllers.registeredParameterLSB:
    case MIDIControllers.registeredParameterMSB:
      this._midiControllers[MIDIControllers.dataEntryMSB] = 0;
      this.lastParameterIsRegistered = true;
      break;
    case MIDIControllers.nonRegisteredParameterMSB:
      this.sf2NRPNGeneratorLSB = 0;
      this._midiControllers[MIDIControllers.dataEntryMSB] = 0;
      this.lastParameterIsRegistered = false;
      break;
    case MIDIControllers.nonRegisteredParameterLSB:
      if (this._midiControllers[MIDIControllers.nonRegisteredParameterMSB] >> 7 === NonRegisteredMSB.SF2) {
        if (this.sf2NRPNGeneratorLSB % 100 !== 0) this.sf2NRPNGeneratorLSB = 0;
        switch (value) {
          case 100:
            this.sf2NRPNGeneratorLSB += 100;
            break;
          case 101:
            this.sf2NRPNGeneratorLSB += 1e3;
            break;
          case 102:
            this.sf2NRPNGeneratorLSB += 1e4;
            break;
          default:
            if (value < 100) this.sf2NRPNGeneratorLSB += value;
        }
      }
      this._midiControllers[MIDIControllers.dataEntryMSB] = 0;
      this.lastParameterIsRegistered = false;
      break;
    case MIDIControllers.dataEntryMSB:
    case MIDIControllers.dataEntryLSB:
      this.dataEntry();
      break;
    case MIDIControllers.resetAllControllers:
      this.resetRP15();
      break;
    case MIDIControllers.sustainPedal:
      if (value < 64) {
        let vc = 0;
        if (this._voiceCount > 0) {
          for (const v of this.synthCore.voices) if (v.channel === this.channel && v.isActive && v.isHeld) {
            v.isHeld = false;
            v.releaseVoice(this.synthCore.currentTime);
            if (++vc >= this._voiceCount) break;
          }
        }
      }
      break;
    case MIDIControllers.portamentoControl:
      this.lastPortamentoNote = value;
      this.portamentoForce = true;
      break;
    default:
      this.computeModulatorsAll(1, controller);
      break;
  }
  if (!sendEvent) return;
  this.synthCore.callEvent("controllerChange", {
    channel: this.channel,
    controller,
    value
  });
}
var AWE_NRPN_GENERATOR_MAPPINGS = [
  GeneratorTypes.delayModLFO,
  GeneratorTypes.freqModLFO,
  GeneratorTypes.delayVibLFO,
  GeneratorTypes.freqVibLFO,
  GeneratorTypes.delayModEnv,
  GeneratorTypes.attackModEnv,
  GeneratorTypes.holdModEnv,
  GeneratorTypes.decayModEnv,
  GeneratorTypes.sustainModEnv,
  GeneratorTypes.releaseModEnv,
  GeneratorTypes.delayVolEnv,
  GeneratorTypes.attackVolEnv,
  GeneratorTypes.holdVolEnv,
  GeneratorTypes.decayVolEnv,
  GeneratorTypes.sustainVolEnv,
  GeneratorTypes.releaseVolEnv,
  GeneratorTypes.fineTune,
  GeneratorTypes.modLfoToPitch,
  GeneratorTypes.vibLfoToPitch,
  GeneratorTypes.modEnvToPitch,
  GeneratorTypes.modLfoToVolume,
  GeneratorTypes.initialFilterFc,
  GeneratorTypes.initialFilterQ,
  GeneratorTypes.modLfoToFilterFc,
  GeneratorTypes.modEnvToFilterFc,
  GeneratorTypes.chorusEffectsSend,
  GeneratorTypes.reverbEffectsSend
];
var clip = (v, min, max) => Math.max(min, Math.min(max, v));
var msToTimecents = (ms) => Math.max(-32768, 1200 * Math.log2(ms / 1e3));
var hzToCents = (hz) => 6900 + 1200 * Math.log2(hz / 440);
function handleAWE32NRPN(paramLSB, dataValue) {
  const dataLSB = dataValue & 127;
  dataValue -= 8192;
  const generator = AWE_NRPN_GENERATOR_MAPPINGS[paramLSB];
  if (!generator) SpessaLog.unsupported(`AWE32 LSB for ${this.channel}`, [paramLSB], "Invalid Generator Number");
  let milliseconds, hertz, centibels, cents;
  switch (generator) {
    default:
      break;
    case GeneratorTypes.delayModLFO:
    case GeneratorTypes.delayVibLFO:
    case GeneratorTypes.delayVolEnv:
    case GeneratorTypes.delayModEnv:
      milliseconds = 4 * clip(dataValue, 0, 5900);
      this.setGeneratorOverride(generator, msToTimecents(milliseconds));
      break;
    case GeneratorTypes.attackVolEnv:
    case GeneratorTypes.attackModEnv:
      milliseconds = clip(dataValue, 0, 5940);
      this.setGeneratorOverride(generator, msToTimecents(milliseconds));
      break;
    case GeneratorTypes.holdVolEnv:
    case GeneratorTypes.holdModEnv:
      milliseconds = clip(dataValue, 0, 8191);
      this.setGeneratorOverride(generator, msToTimecents(milliseconds));
      break;
    case GeneratorTypes.decayModEnv:
    case GeneratorTypes.decayVolEnv:
    case GeneratorTypes.releaseVolEnv:
    case GeneratorTypes.releaseModEnv:
      milliseconds = 4 * clip(dataValue, 0, 5940);
      this.setGeneratorOverride(generator, msToTimecents(milliseconds));
      break;
    case GeneratorTypes.freqVibLFO:
    case GeneratorTypes.freqModLFO:
      hertz = 0.084 * dataLSB;
      this.setGeneratorOverride(generator, hzToCents(hertz), true);
      break;
    case GeneratorTypes.sustainVolEnv:
    case GeneratorTypes.sustainModEnv:
      centibels = dataLSB * 7.5;
      this.setGeneratorOverride(generator, centibels);
      break;
    case GeneratorTypes.fineTune:
      this.setGeneratorOverride(generator, dataValue, true);
      break;
    case GeneratorTypes.modLfoToPitch:
    case GeneratorTypes.vibLfoToPitch:
      cents = clip(dataValue, -127, 127) * 9.375;
      this.setGeneratorOverride(generator, cents, true);
      break;
    case GeneratorTypes.modEnvToPitch:
      cents = clip(dataValue, -127, 127) * 9.375;
      this.setGeneratorOverride(generator, cents);
      break;
    case GeneratorTypes.modLfoToVolume:
      centibels = 1.875 * dataLSB;
      this.setGeneratorOverride(generator, centibels, true);
      break;
    case GeneratorTypes.initialFilterFc: {
      const fcCents = 4335 + 59 * dataLSB;
      this.setGeneratorOverride(generator, fcCents, true);
      break;
    }
    case GeneratorTypes.initialFilterQ:
      centibels = 215 * (dataLSB / 127);
      this.setGeneratorOverride(generator, centibels, true);
      break;
    case GeneratorTypes.modLfoToFilterFc:
      cents = clip(dataValue, -64, 63) * 56.25;
      this.setGeneratorOverride(generator, cents, true);
      break;
    case GeneratorTypes.modEnvToFilterFc:
      cents = clip(dataValue, -64, 63) * 56.25;
      this.setGeneratorOverride(generator, cents);
      break;
    case GeneratorTypes.chorusEffectsSend:
    case GeneratorTypes.reverbEffectsSend:
      this.setGeneratorOverride(generator, clip(dataValue, 0, 255) * (1e3 / 255));
      break;
  }
}
function dataEntry() {
  const dataValue = this._midiControllers[MIDIControllers.dataEntryMSB];
  if (this.lastParameterIsRegistered) {
    const rpnValue = this._midiControllers[MIDIControllers.registeredParameterMSB] | this._midiControllers[MIDIControllers.registeredParameterLSB] >> 7;
    switch (rpnValue) {
      default:
        SpessaLog.info(`%cUnrecognized RPN for %c${this.channel}%c: %c(0x${rpnValue.toString(16)})%c data value: %c${dataValue}`, ConsoleColors.warn, ConsoleColors.recognized, ConsoleColors.warn, ConsoleColors.unrecognized, ConsoleColors.warn, ConsoleColors.value);
        break;
      case RegisteredParameterTypes.pitchWheelRange: {
        const range = dataValue / 128;
        this.setMIDIParameter("pitchWheelRange", range);
        SpessaLog.coolInfo(`Pitch Wheel Range for ${this.channel}`, range, "semitones");
        break;
      }
      case RegisteredParameterTypes.coarseTuning: {
        const semitones = (dataValue >> 7) - 64;
        this.setMIDIParameter("keyShift", semitones);
        SpessaLog.coolInfo(`Key shift for ${this.channel}`, semitones);
        break;
      }
      case RegisteredParameterTypes.fineTuning: {
        const cents = (dataValue - 8192) / 81.92;
        this.setMIDIParameter("fineTune", cents);
        SpessaLog.coolInfo(`Fine tuning for ${this.channel}`, Math.round(cents), "cents");
        break;
      }
      case RegisteredParameterTypes.modulationDepth: {
        const cents = dataValue / 1.28;
        this.setMIDIParameter("modulationDepth", cents);
        SpessaLog.coolInfo(`Modulation depth for ${this.channel}`, Math.round(cents), "cents");
        break;
      }
      case RegisteredParameterTypes.resetParameters:
        break;
    }
    return;
  }
  const paramCoarse = this._midiControllers[MIDIControllers.nonRegisteredParameterMSB] >> 7;
  const paramFine = this._midiControllers[MIDIControllers.nonRegisteredParameterLSB] >> 7;
  const dataCoarse = dataValue >> 7;
  if (this.synthCore.systemParameters.drumLock && paramCoarse >= NonRegisteredMSB.drumPitch && paramCoarse <= NonRegisteredMSB.drumDelay) return;
  switch (paramCoarse) {
    default:
      SpessaLog.info(`%cUnrecognized NRPN for %c${this.channel}%c: %c(0x${paramCoarse.toString(16).toUpperCase()} 0x${paramFine.toString(16).toUpperCase()})%c data value: %c${dataCoarse}`, ConsoleColors.warn, ConsoleColors.recognized, ConsoleColors.warn, ConsoleColors.unrecognized, ConsoleColors.warn, ConsoleColors.value);
      break;
    case NonRegisteredMSB.partParameter: {
      const paramLock = this._systemParameters.nrpnParamLock ?? this.synthCore.systemParameters.nrpnParamLock;
      switch (paramFine) {
        default:
          SpessaLog.info(`%cUnrecognized NRPN for %c${this.channel}%c: %c(0x${paramCoarse.toString(16)} 0x${paramFine.toString(16)})%c data value: %c${dataCoarse}`, ConsoleColors.warn, ConsoleColors.recognized, ConsoleColors.warn, ConsoleColors.unrecognized, ConsoleColors.warn, ConsoleColors.value);
          break;
        case NonRegisteredLSB.vibratoRate:
          this.controllerChange(MIDIControllers.vibratoRate, dataCoarse);
          break;
        case NonRegisteredLSB.vibratoDepth:
          this.controllerChange(MIDIControllers.vibratoDepth, dataCoarse);
          break;
        case NonRegisteredLSB.vibratoDelay:
          this.controllerChange(MIDIControllers.vibratoDelay, dataCoarse);
          break;
        case NonRegisteredLSB.tvfCutoffFrequency:
          if (paramLock) return;
          this.controllerChange(MIDIControllers.brightness, dataCoarse);
          SpessaLog.coolInfo(`Filter cutoff for ${this.channel}`, dataCoarse.toString(), "");
          break;
        case NonRegisteredLSB.tvfResonance:
          if (paramLock) return;
          this.controllerChange(MIDIControllers.filterResonance, dataCoarse);
          SpessaLog.coolInfo(`Filter resonance for ${this.channel}`, dataCoarse.toString(), "");
          break;
        case NonRegisteredLSB.envelopeAttackTime:
          if (paramLock) return;
          this.controllerChange(MIDIControllers.attackTime, dataCoarse);
          SpessaLog.coolInfo(`EG attack time for ${this.channel}`, dataCoarse.toString(), "");
          break;
        case NonRegisteredLSB.envelopeDecayTime:
          if (paramLock) return;
          this.controllerChange(MIDIControllers.decayTime, dataCoarse);
          SpessaLog.coolInfo(`EG decay time for ${this.channel}`, dataCoarse.toString(), "");
          break;
        case NonRegisteredLSB.envelopeReleaseTime:
          if (paramLock) return;
          this.controllerChange(MIDIControllers.releaseTime, dataCoarse);
          SpessaLog.coolInfo(`EG release time for ${this.channel}`, dataCoarse.toString(), "");
          break;
      }
      break;
    }
    case NonRegisteredMSB.drumPitch: {
      const pitch = this.channelSystem === "xg" || this.patch.bankLSB === 1 ? (dataCoarse - 64) * 100 : (dataCoarse - 64) * 50;
      this.drumParams[paramFine].pitch = pitch;
      SpessaLog.coolInfo(`Drum ${paramFine} pitch for ${this.channel}`, pitch, "cents");
      break;
    }
    case NonRegisteredMSB.drumPitchFine: {
      const pitch = dataCoarse - 64;
      this.drumParams[paramFine].pitch += pitch;
      SpessaLog.coolInfo(`Drum ${paramFine} pitch fine for ${this.channel}`, this.drumParams[paramFine].pitch, "cents");
      break;
    }
    case NonRegisteredMSB.drumLevel:
      this.drumParams[paramFine].gain = dataCoarse / 120;
      SpessaLog.coolInfo(`Drum ${paramFine} level for ${this.channel}`, dataCoarse, "");
      break;
    case NonRegisteredMSB.drumPan:
      this.drumParams[paramFine].pan = dataCoarse;
      SpessaLog.coolInfo(`Drum ${paramFine} pan for ${this.channel}`, dataCoarse, "");
      break;
    case NonRegisteredMSB.drumReverb:
      this.drumParams[paramFine].reverbGain = dataCoarse / 127;
      SpessaLog.coolInfo(`Drum ${paramFine} reverb level for ${this.channel}`, dataCoarse, "");
      break;
    case NonRegisteredMSB.drumChorus:
      this.drumParams[paramFine].chorusGain = dataCoarse / 127;
      SpessaLog.coolInfo(`Drum ${paramFine} chorus level for ${this.channel}`, dataCoarse, "");
      break;
    case NonRegisteredMSB.drumDelay:
      this.drumParams[paramFine].delayGain = dataCoarse / 127;
      SpessaLog.coolInfo(`Drum ${paramFine} delay level for ${this.channel}`, dataValue, "");
      break;
    case NonRegisteredMSB.awe32:
      handleAWE32NRPN.call(this, paramFine, dataValue);
      break;
    case NonRegisteredMSB.SF2: {
      if (paramFine > 100) break;
      const gen = this.sf2NRPNGeneratorLSB;
      const offset = dataValue - 8192;
      this.setGeneratorOffset(gen, offset);
      break;
    }
  }
}
var PORTA_DIVISION_CONSTANT = 40;
function portaTimeToRate(cc) {
  if (cc < 1) return 0;
  else {
    const x0 = [
      1,
      2,
      4,
      8,
      16,
      32,
      64,
      80,
      96,
      112,
      120,
      124
    ];
    const ih = [
      1,
      0.5,
      0.25,
      0.125,
      0.0625,
      0.03125,
      0.0625,
      0.0625,
      0.0625,
      0.125,
      0.25,
      1 / 3
    ];
    const a = [
      -0.16653127382501215,
      0.11863875218299408,
      0.029479047361245264,
      -0.005442312089231738,
      0.1451520875973037,
      -0.005056281449558275,
      -0.005095486882876532,
      0.03334009551111544,
      -0.09361368678020432,
      0.14132569702451822,
      -0.15805565301011382,
      -0.09918856955881927
    ];
    const b = [
      0.028212773333433472,
      -0.3388502064992847,
      -0.15839529890929713,
      -0.12398131766775483,
      -0.2874848552685111,
      0.012254866302537692,
      0.005957797193345771,
      -0.03745899330347374,
      0.12911781869810196,
      -0.15867193224162568,
      0.504406322732748,
      0.3786845131875458
    ];
    const c = [
      0.7218950861255283,
      0.5574536226347168,
      0.47133893237025826,
      0.48597095327079914,
      0.44336276333518854,
      0.6076986311801551,
      0.30851975971827794,
      0.30514889345633955,
      0.3302511933827384,
      0.153822885219165,
      0.1302280559047337,
      0.49865530675491687
    ];
    const d = [
      -2.2218487496163566,
      -1.6382721639824072,
      -1.3010299956639813,
      -0.958607314841775,
      -0.6020599913279624,
      -0.3010299956639812,
      0.31386722036915343,
      0.6232492903979004,
      0.9242792860618817,
      1.290034611362518,
      1.4265112613645752,
      1.9030899869919435
    ];
    const thresholds = [
      2,
      4,
      8,
      16,
      32,
      64,
      80,
      96,
      112,
      120,
      124
    ];
    let s = -1;
    for (let i = thresholds.length - 1; i >= 0; i--) if (thresholds[i] < cc) {
      s = i;
      break;
    }
    s += 1;
    const t = (cc - x0[s]) * ih[s];
    return Math.exp(2.302585092994046 * (((a[s] * t + b[s]) * t + c[s]) * t + d[s])) / PORTA_DIVISION_CONSTANT;
  }
}
function portamentoTimeToSeconds(time, distance) {
  return portaTimeToRate(time) * distance;
}
var clamp = (num, min, max) => Math.max(min, Math.min(max, num));
function noteOn(midiNote, velocity, emit = true) {
  if (velocity < 1) {
    this.noteOff(midiNote);
    return;
  }
  const black = this.synthCore.systemParameters.blackMIDIMode;
  if (black && this.synthCore.voiceCount > 200 && velocity < 40 || black && velocity < 10 || this._systemParameters.isMuted || !this.preset) return;
  let realVelocity = clamp(velocity * (this._midiParameters.velocitySenseDepth / 64) + (this._midiParameters.velocitySenseOffset - 64) * 2, 0, 127);
  let soundBankNote = midiNote + this.currentKeyShift;
  if (midiNote > 127 || midiNote < 0) return;
  const program = this.preset.program;
  const tune = this.synthCore.tunings[program * 128 + midiNote];
  if (tune >= 0) soundBankNote = Math.trunc(tune);
  if ((this._systemParameters.monophonicRetrigger ?? this.synthCore.systemParameters.monophonicRetrigger) || this._midiParameters.assignMode === 0) this.killNote(midiNote);
  const keyVel = this.synthCore.keyModifierManager.getVelocity(this.channel, midiNote);
  if (keyVel > -1) realVelocity = keyVel;
  let voiceGain = this.synthCore.keyModifierManager.getGain(this.channel, midiNote);
  const previousNote = this.lastPortamentoNote;
  const portamentoEnabled = this.portamentoForce || this._midiControllers[MIDIControllers.portamentoOnOff] >= 8192;
  const portamentoTime = this._midiControllers[MIDIControllers.portamentoTime] >> 7;
  const canApplyPortamento = portamentoEnabled && !this._drumChannel && previousNote >= 0 && previousNote !== midiNote && portamentoTime > 0;
  let portaFromKey = -1;
  let portaTime = 0;
  if (canApplyPortamento) {
    const keyDistance = Math.abs(midiNote - previousNote);
    portaFromKey = previousNote;
    portaTime = portamentoTimeToSeconds(portamentoTime, keyDistance);
    this.portamentoForce = false;
  }
  this.lastPortamentoNote = midiNote;
  this.playingNotes[midiNote] = true;
  if (!this._midiParameters.polyMode) {
    if (this.lastMonoNote >= 0 && this.lastMonoNote !== midiNote) this.killNote(this.lastMonoNote);
    this.lastMonoNote = midiNote;
    this.lastMonoVelocity = velocity;
  }
  const voices = this.synthCore.getVoices(this.channel, soundBankNote, realVelocity);
  let panOverride = 0;
  let exclusiveOverride = 0;
  let pitchOffset = 0;
  let reverbSend = 1;
  let chorusSend = 1;
  let delaySend = 1;
  if (this._midiParameters.randomPan) panOverride = Math.round(Math.random() * 1e3 - 500);
  if (this._drumChannel) {
    const p = this.drumParams[midiNote];
    if (!p.rxNoteOn) return;
    const drumPan = p.pan - 64;
    if (drumPan !== 0) if (drumPan === -64) panOverride = Math.round(Math.random() * 1e3 - 500);
    else {
      const channelPan = (this._midiControllers[MIDIControllers.pan] >> 7) - 64;
      panOverride = Math.max(-63, Math.min(drumPan + channelPan, 63)) / 63 * 500 || 1;
    }
    pitchOffset = p.pitch;
    exclusiveOverride = p.exclusiveClass;
    reverbSend = p.reverbGain;
    chorusSend = p.chorusGain;
    delaySend = p.delayGain;
    if (voiceGain === 1) voiceGain = p.gain;
  }
  const noteID = emit ? this.noteOnID[midiNote]++ : this.noteOnID[midiNote];
  for (const cached of voices) {
    const voice = this.synthCore.assignVoice();
    const now = this.synthCore.currentTime;
    voice.setup(now, this.channel, midiNote, noteID);
    voice.wavetable = voice.oscillators[this._systemParameters.interpolationType ?? this.synthCore.systemParameters.interpolationType];
    voice.targetKey = cached.targetKey;
    voice.velocity = cached.velocity;
    voice.generators.set(cached.generators);
    voice.exclusiveClass = exclusiveOverride || cached.exclusiveClass;
    voice.rootKey = cached.rootKey;
    voice.loopingMode = cached.loopingMode;
    voice.wavetable.sampleData = cached.sampleData;
    voice.wavetable.playbackStep = cached.playbackStep;
    if (this.dynamicModulators.active) {
      voice.modulators = [...cached.modulators];
      for (const m of this.dynamicModulators.modulatorList) {
        const existingModIndex = voice.modulators.findIndex((voiceMod) => Modulator.isIdentical(voiceMod, m.mod));
        if (existingModIndex === -1) voice.modulators.push(m.mod);
        else voice.modulators[existingModIndex] = m.mod;
      }
    } else voice.modulators = cached.modulators;
    if (voice.modulators.length > voice.modulatorValues.length) {
      SpessaLog.warn(`${voice.modulators.length} modulators! Increasing modulatorValues table.`);
      voice.modulatorValues = new Int16Array(voice.modulators.length);
    }
    if (this.generators.overridesEnabled) {
      const g = this.generators.overrides;
      for (let type = 0; type < GENERATORS_AMOUNT; type++) {
        const overrideValue = g[type];
        if (overrideValue === 32767) continue;
        voice.generators[type] = overrideValue;
      }
    }
    if (voice.exclusiveClass !== 0 && this._midiParameters.polyMode) {
      let vc = 0;
      if (this._voiceCount > 0) {
        for (const v of this.synthCore.voices) if (v.isActive && v.channel === this.channel && v.exclusiveClass === voice.exclusiveClass && v.hasRendered) {
          v.exclusiveRelease(this.synthCore.currentTime);
          if (++vc >= this._voiceCount) break;
        }
      }
    }
    this.computeModulators(voice);
    voice.volEnv.init(voice);
    voice.modEnv.init(voice);
    voice.filter.init();
    voice.vibLfoStartTime = now + timecentsToSeconds(voice.modulatedGenerators[GeneratorTypes.delayVibLFO]);
    voice.modLfoStartTime = now + timecentsToSeconds(voice.modulatedGenerators[GeneratorTypes.delayModLFO]);
    const cursorStartOffset = voice.modulatedGenerators[GeneratorTypes.startAddrsOffset] + voice.modulatedGenerators[GeneratorTypes.startAddrsCoarseOffset] * 32768;
    const endOffset = voice.modulatedGenerators[GeneratorTypes.endAddrOffset] + voice.modulatedGenerators[GeneratorTypes.endAddrsCoarseOffset] * 32768;
    const loopStartOffset = voice.modulatedGenerators[GeneratorTypes.startloopAddrsOffset] + voice.modulatedGenerators[GeneratorTypes.startloopAddrsCoarseOffset] * 32768;
    const loopEndOffset = voice.modulatedGenerators[GeneratorTypes.endloopAddrsOffset] + voice.modulatedGenerators[GeneratorTypes.endloopAddrsCoarseOffset] * 32768;
    const endExclusive = cached.sampleData.length;
    voice.wavetable.cursor = clamp(cursorStartOffset, 0, endExclusive - 1);
    voice.wavetable.end = clamp(endExclusive + endOffset, 0, endExclusive);
    voice.wavetable.loopStart = clamp(cached.loopStart + loopStartOffset, 0, endExclusive);
    voice.wavetable.loopEnd = clamp(cached.loopEnd + loopEndOffset, 0, endExclusive);
    if (voice.wavetable.loopEnd < voice.wavetable.loopStart) {
      const temp = voice.wavetable.loopStart;
      voice.wavetable.loopStart = voice.wavetable.loopEnd;
      voice.wavetable.loopEnd = temp;
    }
    if (voice.wavetable.loopEnd - voice.wavetable.loopStart < 1 && (voice.loopingMode === 1 || voice.loopingMode === 3)) voice.loopingMode = 0;
    voice.wavetable.loopLength = voice.wavetable.loopEnd - voice.wavetable.loopStart;
    voice.wavetable.isLooping = voice.loopingMode === 1 || voice.loopingMode === 3;
    voice.portamentoFromKey = portaFromKey;
    voice.portamentoDuration = portaTime;
    voice.overridePan = panOverride;
    voice.gainModifier = voiceGain;
    voice.pitchOffset = pitchOffset;
    voice.reverbSend = reverbSend;
    voice.chorusSend = chorusSend;
    voice.delaySend = delaySend;
    voice.currentPan = Math.max(-500, Math.min(500, panOverride || voice.modulatedGenerators[GeneratorTypes.pan]));
  }
  this._voiceCount += voices.length;
  if (emit) this.synthCore.callEvent("noteOn", {
    midiNote,
    channel: this.channel,
    velocity
  });
}
function noteOff(midiNote) {
  if (midiNote > 127 || midiNote < 0) return;
  if (this.synthCore.systemParameters.blackMIDIMode && !this._drumChannel || this._drumChannel && this.drumParams[midiNote].rxNoteOff) {
    this.killNote(midiNote);
    this.synthCore.callEvent("noteOff", {
      midiNote,
      channel: this.channel
    });
    return;
  }
  this.playingNotes[midiNote] = false;
  const mono = !this._midiParameters.polyMode;
  const sustain = this._midiControllers[MIDIControllers.sustainPedal] >= 8192 && !mono;
  let vc = 0;
  const noteID = this.noteOffID[midiNote];
  if (noteID < this.noteOnID[midiNote]) this.noteOffID[midiNote]++;
  if (this._voiceCount > 0) {
    for (const v of this.synthCore.voices) if (v.channel === this.channel && v.isActive && v.midiNote === midiNote && v.noteID === noteID && !v.isInRelease) {
      if (sustain) v.isHeld = true;
      else v.releaseVoice(this.synthCore.currentTime);
      if (++vc >= this._voiceCount) break;
    }
  }
  this.synthCore.callEvent("noteOff", {
    midiNote,
    channel: this.channel
  });
  if (mono) {
    const highest = this.playingNotes.lastIndexOf(true);
    if (highest === -1) this.lastMonoNote = -1;
    else if (this.lastMonoNote === midiNote) this.noteOn(highest, this.lastMonoVelocity, false);
  }
}
function programChange(program) {
  if (this._systemParameters.presetLock) return;
  this.patch.program = program;
  let preset = this.synthCore.soundBankManager.getPreset(this.patch, this.channelSystem);
  if (!preset) {
    preset = this.synthCore.missingPresetHandler(this.patch, this.channelSystem);
    if (!preset) return;
  }
  this.preset = preset;
  if (preset.isDrum !== this._drumChannel) this.setDrumFlag(preset.isDrum);
  this.resetDrumParams();
  this.synthCore.callEvent("programChange", {
    channel: this.channel,
    bankLSB: this.preset.bankLSB,
    bankMSB: this.preset.bankMSB,
    program: this.preset.program,
    name: this.preset.name,
    isGMGSDrum: this.preset.isGMGSDrum,
    isDrum: this.preset.isDrum
  });
}
var INITIAL_MODULATORS = [VoiceModulator.fromModulator(new DecodedModulator(getModSourceEnum(ModulatorCurveTypes.linear, true, false, true, MIDIControllers.vibratoRate), 0, GeneratorTypes.vibLfoRate, 1e3, 0))];
var DynamicModulatorManager = class {
  /**
  * The current dynamic modulator list.
  */
  modulatorList = [];
  active = false;
  channel;
  constructor(channel) {
    this.channel = channel;
  }
  resetModulators() {
    this.modulatorList = INITIAL_MODULATORS.map((m) => {
      return {
        mod: m,
        id: this.getModulatorID(m.primarySource.toSourceEnum(), m.destination, m.primarySource.isBipolar, m.primarySource.isNegative)
      };
    });
    this.active = false;
  }
  setupReceiver(addr3, data, source, isCC, sourceName, bipolar = false) {
    this.active = true;
    const centeredValue = data - 64;
    const centeredNormalized = centeredValue / 64;
    const normalizedNotCentered = data / 127;
    switch (addr3 & 15) {
      case 0:
        this.setModulator(source, isCC, GeneratorTypes.fineTune, centeredValue * 100, bipolar);
        SpessaLog.coolInfo(`Channel ${this.channel} ${sourceName} pitch control`, centeredValue, "semitones");
        break;
      case 1:
        this.setModulator(source, isCC, GeneratorTypes.initialFilterFc, centeredNormalized * 9600, bipolar);
        SpessaLog.coolInfo(`Channel ${this.channel} ${sourceName} filter control`, centeredNormalized * 9600, "cents");
        break;
      case 2:
        this.setModulator(source, isCC, GeneratorTypes.amplitude, centeredNormalized * 1e3, bipolar);
        SpessaLog.coolInfo(`Channel ${this.channel} ${sourceName} amplitude control`, centeredNormalized * 100, "%");
        break;
      case 3:
        this.setModulator(source, isCC, GeneratorTypes.vibLfoRate, centeredNormalized * 1e3, bipolar);
        SpessaLog.coolInfo(`Channel ${this.channel} ${sourceName} LFO1 rate control`, centeredNormalized * 10, "Hz");
        break;
      case 4:
        this.setModulator(source, isCC, GeneratorTypes.vibLfoToPitch, normalizedNotCentered * 600, bipolar);
        SpessaLog.coolInfo(`Channel ${this.channel} ${sourceName} LFO1 pitch depth control`, normalizedNotCentered * 600, "cents");
        break;
      case 5:
        this.setModulator(source, isCC, GeneratorTypes.vibLfoToFilterFc, normalizedNotCentered * 2400, bipolar);
        SpessaLog.coolInfo(`Channel ${this.channel} ${sourceName} LFO1 filter depth control`, normalizedNotCentered * 2400, "cents");
        break;
      case 6:
        this.setModulator(source, isCC, GeneratorTypes.vibLfoAmplitudeDepth, normalizedNotCentered * 1e3, bipolar);
        SpessaLog.coolInfo(`Channel ${this.channel} ${sourceName} LFO1 amplitude depth control`, normalizedNotCentered * 100, "%");
        break;
      case 7:
        this.setModulator(source, isCC, GeneratorTypes.modLfoRate, centeredNormalized * 1e3, bipolar);
        SpessaLog.coolInfo(`Channel ${this.channel} ${sourceName} LFO2 rate control`, centeredNormalized * 10, "Hz");
        break;
      case 8:
        this.setModulator(source, isCC, GeneratorTypes.modLfoToPitch, normalizedNotCentered * 600, bipolar);
        SpessaLog.coolInfo(`Channel ${this.channel} ${sourceName} LFO2 pitch depth control`, normalizedNotCentered * 600, "cents");
        break;
      case 9:
        this.setModulator(source, isCC, GeneratorTypes.modLfoToFilterFc, normalizedNotCentered * 2400, bipolar);
        SpessaLog.coolInfo(`Channel ${this.channel} ${sourceName} LFO2 filter depth control`, normalizedNotCentered * 2400, "cents");
        break;
      case 10:
        this.setModulator(source, isCC, GeneratorTypes.modLfoAmplitudeDepth, normalizedNotCentered * 1e3, bipolar);
        SpessaLog.coolInfo(`Channel ${this.channel} ${sourceName} LFO2 amplitude depth control`, normalizedNotCentered * 100, "%");
        break;
    }
  }
  /**
  * @param source The source index.
  * @param isCC If the source is an SF2 source or a MIDI CC source.
  * @param destination The generator type to modulate.
  * @param amount The amount of modulation to apply.
  * @param isBipolar If true, the modulation is bipolar (ranges from -1 to 1 instead of from 0 to 1).
  * @param isNegative If true, the modulation is negative (goes from 1 to 0 instead of from 0 to 1).
  */
  setModulator(source, isCC, destination, amount, isBipolar = false, isNegative = false) {
    const id = this.getModulatorID(source, destination, isBipolar, isNegative);
    if (amount === 0) this.deleteModulator(id);
    const mod = this.modulatorList.find((m) => m.id === id);
    if (mod) mod.mod.transformAmount = amount;
    else {
      const modulator = VoiceModulator.fromData(new ModulatorSource(source, ModulatorCurveTypes.linear, isCC, isBipolar), new ModulatorSource(), destination, amount, 0);
      this.modulatorList.push({
        mod: modulator,
        id
      });
    }
  }
  getModulatorID(source, destination, isBipolar, isNegative) {
    return `${source}-${destination}-${isBipolar}-${isNegative}`;
  }
  deleteModulator(id) {
    this.modulatorList = this.modulatorList.filter((m) => m.id !== id);
  }
};
var EFFECT_MODULATOR_TRANSFORM_MULTIPLIER = 1e3 / 200;
function computeModulator(voice, pitchWheel, modulatorIndex) {
  const modulator = voice.modulators[modulatorIndex];
  if (modulator.transformAmount === 0) {
    voice.modulatorValues[modulatorIndex] = 0;
    return 0;
  }
  const sourceValue = modulator.primarySource.getValue(this, pitchWheel, voice);
  const secondSrcValue = modulator.secondarySource.getValue(this, pitchWheel, voice);
  let transformAmount = modulator.transformAmount;
  if (modulator.isEffectModulator && transformAmount <= 1e3) {
    transformAmount *= EFFECT_MODULATOR_TRANSFORM_MULTIPLIER;
    transformAmount = Math.min(transformAmount, 1e3);
  }
  let computedValue = sourceValue * secondSrcValue * transformAmount;
  if (modulator.transformType === 2) computedValue = Math.abs(computedValue);
  if (modulator.isDefaultResonantModulator) voice.resonanceOffset = Math.max(0, computedValue / 2);
  if (modulator.isModWheelModulator) computedValue *= this._midiParameters.modulationDepth / 50;
  voice.modulatorValues[modulatorIndex] = computedValue;
  return computedValue;
}
function computeModulators(voice, sourceUsesCC = -1, sourceIndex = 0) {
  const modulators = voice.modulators;
  let generators = voice.generators;
  if (this.generators.offsetsEnabled) {
    const g = this.generators.offsets;
    generators = new Int16Array(generators);
    for (let i = 0; i < generators.length; i++) generators[i] += g[i];
  }
  const modulatedGenerators = voice.modulatedGenerators;
  const pitch = this.perNotePitch ? this.pitchWheels[voice.midiNote] : this._midiParameters.pitchWheel;
  if (sourceUsesCC === -1) {
    modulatedGenerators.set(generators);
    for (let i = 0; i < modulators.length; i++) {
      const mod = modulators[i];
      modulatedGenerators[mod.destination] = Math.min(32767, Math.max(-32768, modulatedGenerators[mod.destination] + this.computeModulator(voice, pitch, i)));
    }
    for (let gen = 0; gen < modulatedGenerators.length; gen++) {
      const limit = GeneratorLimits[gen];
      if (!limit) continue;
      modulatedGenerators[gen] = Math.min(limit.max, Math.max(limit.min, modulatedGenerators[gen]));
    }
    return;
  }
  const sourceCC = !!sourceUsesCC;
  for (let i = 0; i < modulators.length; i++) {
    const mod = modulators[i];
    if (mod.primarySource.isCC === sourceCC && mod.primarySource.index === sourceIndex || mod.secondarySource.isCC === sourceCC && mod.secondarySource.index === sourceIndex) {
      const destination = mod.destination;
      let outputValue = generators[destination];
      this.computeModulator(voice, pitch, i);
      for (let j = 0; j < modulators.length; j++) if (modulators[j].destination === destination) outputValue += voice.modulatorValues[j];
      const limits = GeneratorLimits[destination];
      modulatedGenerators[destination] = Math.max(limits.min, Math.min(outputValue, limits.max));
    }
  }
}
var DrumParameters = class DrumParameters2 {
  /**
  * Pitch offset in cents.
  */
  pitch = 0;
  /**
  * Gain multiplier.
  */
  gain = 1;
  /**
  * Exclusive class override.
  */
  exclusiveClass = 0;
  /**
  * Pan, 1-64-127, 0 is random. This adds to the channel pan!
  */
  pan = 64;
  /**
  * Reverb multiplier.
  */
  reverbGain = 0;
  /**
  * Chorus multiplier.
  */
  chorusGain = 1;
  /**
  * Delay multiplier.
  */
  delayGain = 1;
  /**
  * If note on should be received.
  */
  rxNoteOn = true;
  /**
  * If note off should be received.
  * Note:
  * Due to the way sound banks implement drums (as 100s release time),
  * this means killing the voice on note off, not releasing it.
  */
  rxNoteOff = false;
  static copyFrom(p) {
    const d = new DrumParameters2();
    d.pitch = p.pitch;
    d.chorusGain = p.chorusGain;
    d.reverbGain = p.reverbGain;
    d.exclusiveClass = p.exclusiveClass;
    d.gain = p.gain;
    d.pan = p.pan;
    d.rxNoteOff = p.rxNoteOff;
    d.rxNoteOn = p.rxNoteOn;
    return d;
  }
};
function getChannelSnapshot() {
  return {
    patch: this.preset ? {
      ...this.patch,
      name: this.preset.name,
      isDrum: this.preset.isDrum
    } : void 0,
    lockedSystem: this.lockedSystem,
    midiControllers: this._midiControllers.slice(),
    lockedControllers: [...this.lockedControllers],
    pitchWheels: this.pitchWheels.slice(),
    generators: {
      ...this.generators,
      offsets: this.generators.offsets.slice(),
      overrides: this.generators.overrides.slice()
    },
    midiParameters: { ...this._midiParameters },
    lockedMIDIParameters: { ...this.lockedMIDIParameters },
    systemParameters: { ...this._systemParameters },
    octaveTuning: this.octaveTuning.slice(),
    perNotePitch: this.perNotePitch,
    drumParams: this.drumParams.map((d) => ({ ...d })),
    drumChannel: this._drumChannel,
    channel: this.channel
  };
}
function applySnapshot(snapshot) {
  this.setDrums(snapshot.drumChannel);
  this._midiControllers.set(snapshot.midiControllers);
  for (let i = 0; i < 128; i++) this.lockController(i, snapshot.lockedControllers[i]);
  this.pitchWheels.set(snapshot.pitchWheels);
  this.octaveTuning.set(snapshot.octaveTuning);
  this.perNotePitch = snapshot.perNotePitch;
  this.generators.offsets.set(snapshot.generators.offsets);
  this.generators.overrides.set(snapshot.generators.overrides);
  this.generators.offsetsEnabled = snapshot.generators.offsetsEnabled;
  this.generators.overridesEnabled = snapshot.generators.overridesEnabled;
  for (let i = 0; i < 128; i++) this.drumParams[i] = DrumParameters.copyFrom(snapshot.drumParams[i]);
  this.setSystemParameter("presetLock", false);
  if (snapshot.patch) this.setPatch(snapshot.patch);
  this.lockedSystem = snapshot.lockedSystem;
  for (const [parameter, value] of Object.entries(snapshot.midiParameters)) this.setMIDIParameter(parameter, value);
  for (const [parameter, isLocked] of Object.entries(snapshot.lockedMIDIParameters)) this.lockMIDIParameter(parameter, isLocked);
  for (const [parameter, value] of Object.entries(snapshot.systemParameters)) this.setSystemParameter(parameter, value);
}
var DEFAULT_CHANNEL_MIDI_PARAMETERS = {
  pitchWheel: 8192,
  pitchWheelRange: 2,
  pressure: 0,
  modulationDepth: 50,
  rxChannel: 0,
  polyMode: true,
  keyShift: 0,
  fineTune: 0,
  randomPan: false,
  assignMode: 2,
  efxAssign: false,
  cc1: 16,
  cc2: 17,
  drumMap: 0,
  velocitySenseDepth: 64,
  velocitySenseOffset: 64
};
function setMIDIParameterInternal$1(parameter, value) {
  if (this.lockedMIDIParameters[parameter]) return;
  this._midiParameters[parameter] = value;
  switch (parameter) {
    case "pitchWheel":
      this.computeModulatorsAll(0, ModulatorControllerSources.pitchWheel);
      break;
    case "pressure":
      this.computeModulatorsAll(0, ModulatorControllerSources.channelPressure);
      break;
  }
  this.updateInternalParams();
  this.synthCore.callEvent("channelParamChange", {
    channel: this.channel,
    parameter,
    value
  });
}
function lockMIDIParameterInternal$1(parameter, isLocked) {
  this.lockedMIDIParameters[parameter] = isLocked;
}
var DEFAULT_CHANNEL_SYSTEM_PARAMETERS = {
  presetLock: false,
  isMuted: false,
  gain: 1,
  pan: 0,
  keyShift: 0,
  fineTune: 0,
  interpolationType: null,
  nrpnParamLock: null,
  monophonicRetrigger: null
};
function setSystemParameterInternal(parameter, value) {
  if (this._systemParameters[parameter] === value) return;
  const prev = this._systemParameters[parameter];
  this._systemParameters[parameter] = value;
  this.updateInternalParams();
  switch (parameter) {
    default:
      break;
    case "presetLock":
      if (value) this.lockedSystem = this.synthCore.midiParameters.system;
      break;
    case "isMuted":
      if (value) this.stopAllNotes(true);
      break;
    case "keyShift":
      if (!this._drumChannel && prev !== value) this.stopAllNotes(true);
  }
}
var MIDIChannel = class {
  /**
  * An array for the MIDI 2.0 Per-note pitch wheels.
  * @internal
  */
  pitchWheels = new Int16Array(128).fill(8192);
  /**
  * Parameters for each drum instrument.
  * @internal
  */
  drumParams = [];
  /**
  * A system for dynamic modulator assignment for advanced system exclusives.
  * @internal
  */
  dynamicModulators;
  /**
  * SF2 NRPN LSB for selecting a generator value.
  * @internal
  */
  sf2NRPNGeneratorLSB = 0;
  /**
  * The currently selected MIDI patch of the channel.
  * Note that the exact matching preset may not be available, but this represents exactly what MIDI asks for.
  */
  patch = {
    bankMSB: 0,
    bankLSB: 0,
    program: 0,
    isGMGSDrum: false
  };
  /**
  * The preset currently assigned to the channel.
  * Note that this may be undefined in some cases.
  */
  preset;
  /**
  * Indicates the MIDI system when the preset was locked.
  * @internal
  */
  lockedSystem = "gs";
  /**
  * The channel's number (0-based index)
  */
  channel;
  /**
  * Core synthesis engine.
  * @internal
  */
  synthCore;
  /**
  * Sets a system parameter of the channel.
  * @param parameter The type of the system parameter to set.
  * @param value The value to set for the system parameter.
  */
  setSystemParameter = setSystemParameterInternal.bind(this);
  /**
  * Locks or unlocks a given Channel MIDI Parameter.
  * This prevents any changes to it until it's unlocked.
  * @param parameter The Channel MIDI Parameter to lock.
  * @param isLocked If the parameter should be locked.
  */
  lockMIDIParameter = lockMIDIParameterInternal$1.bind(this);
  /**
  * Sends a "MIDI Note on" message and starts a note.
  * @param midiNote The MIDI note number (0-127).
  * @param velocity The velocity of the note (0-127). If less than 1, it will send a note off instead.
  * @internal
  */
  noteOn = noteOn.bind(this);
  /**
  * Releases a note by its MIDI note number.
  * If the note is in high performance mode and the channel is not a drum channel,
  * it kills the note instead of releasing it.
  * @param midiNote The MIDI note number to release (0-127).
  * @internal
  */
  noteOff = noteOff.bind(this);
  /**
  * Changes the program (preset) of the channel.
  * @param programNumber The program number (0-127) to change to.
  * @internal
  */
  programChange = programChange.bind(this);
  /**
  * Handles MIDI controller changes for a channel.
  * @param controllerNumber The MIDI controller number (0-127).
  * @param controllerValue The value of the controller (0-127).
  * @param sendEvent If an event should be emitted.
  * @remarks
  * This function processes MIDI controller changes, updating the channel's
  * midiControllers table and handling special cases like bank select,
  * data entry, and sustain pedal. It also computes modulators for all voices
  * in the channel based on the controller change.
  * to allow changes.
  * @internal
  */
  controllerChange = controllerChange.bind(this);
  /**
  * Reset this channel to its default state.
  * Except for the locked controllers.
  * @internal
  */
  reset = resetChannelInternal.bind(this);
  /**
  * Renders a voice to the stereo output buffer
  * @param voice the voice to render
  * @param timeNow current time in seconds
  * @param outputL the left output buffer
  * @param outputR the right output buffer
  * @param startIndex
  * @param sampleCount
  * @internal
  */
  renderVoice = renderVoice.bind(this);
  /**
  * Sets a channel MIDI parameter of the synthesizer.
  * @param parameter The type of the channel MIDI parameter to set.
  * @param value The value to set for the channel MIDI parameter.
  * @internal
  */
  setMIDIParameter = setMIDIParameterInternal$1.bind(this);
  /**
  * An array indicating if a controller, at the equivalent index in the midiControllers array, is locked
  * (i.e., not allowed changing).
  * A locked controller cannot be modified.
  * @internal
  */
  lockedControllers = new Array(128).fill(false);
  /**
  * An array of MIDI controllers for the channel.
  * This array is used to store the state of various MIDI controllers
  * such as volume, pan, modulation, etc.
  * @remarks
  * A bit of an explanation:
  * The controller table is stored as an int16 array, it stores 14-bit values, allowing for full 14-bit LSB resolution.
  * The only exception from this are the Registered and Non-Registered Parameter Numbers.
  * Data entries do store it!
  */
  _midiControllers = new Int16Array(128);
  /**
  * An array of octave tuning values for each note on the channel.
  * Each index corresponds to a note (0 = C, 1 = C#, ..., 11 = B).
  * Note: Repeated every 12 notes.
  */
  octaveTuning = new Int8Array(128);
  /**
  * https://amei.or.jp/midistandardcommittee/Recommended_Practice/e/rp15.pdf
  * Reset controllers according to RP-15 Recommended Practice.
  * @internal
  */
  resetRP15 = resetRP15.bind(this);
  /**
  * Executes a data entry coarse (MSB) change for the current channel.
  * @param dataValue The value to set for the data entry coarse controller (0-127).
  * @internal
  */
  dataEntry = dataEntry.bind(this);
  /**
  * An object indicating if a Channel MIDI parameter, at the equivalent key, is locked
  * (i.e., not allowed changing).
  * A locked parameter cannot be modified.
  * @internal
  */
  lockedMIDIParameters = Object.fromEntries(Object.keys(DEFAULT_CHANNEL_MIDI_PARAMETERS).map((key) => [key, false]));
  _midiParameters = { ...DEFAULT_CHANNEL_MIDI_PARAMETERS };
  /**
  * All system parameters of this channel.
  * @internal
  */
  _systemParameters = { ...DEFAULT_CHANNEL_SYSTEM_PARAMETERS };
  /**
  * Note On message tracking, for grouping voices for specific Note On messages.
  * Used for overlapping Note Ons.
  * MIDI note: current note on ID
  * @protected
  */
  noteOnID = new Array(128).fill(0);
  /**
  * Note Off message tracking, for grouping voices for specific Note On messages.
  * Used for overlapping Note Ons.
  * MIDI note: current note on ID
  * @protected
  */
  noteOffID = new Array(128).fill(0);
  /**
  * If the last Parameter was RPN.
  * If false then the last parameter was NRPN.
  * @protected
  */
  lastParameterIsRegistered = true;
  /**
  * Per-note pitch wheel mode uses the pitchWheels table as source
  * instead of the regular entry in the midiControllers table.
  */
  perNotePitch = false;
  /**
  * Current pan in range [-500;500]
  * Updated in `updateInternalParams`.
  * This is used to avoid a big addition for every voice rendering call.
  */
  currentPan = 0;
  /**
  * Current tuning in cents.
  * Updated in `updateInternalParams`.
  * This is used to avoid a big addition for every voice rendering call.
  */
  currentTuning = 0;
  /**
  * Current key-shift.
  * Updated in `updateInternalParams`.
  */
  currentKeyShift = 0;
  /**
  * Current gain.
  * Updated in `updateInternalParams`.
  * This is used to avoid a big multiplication for every voice rendering call.
  */
  currentGain = 0;
  /**
  * The last pressed note on this channel for portamento tracking.
  * -1 means none.
  * This is not a `ChannelMIDIParameter` and is strictly internal,
  * mostly because we don't want to send events for every note on message.
  * It can be set with Portamento Control CC anyway.
  * @protected
  */
  lastPortamentoNote = -1;
  /**
  * If the portamento should be executed once regardless of Portamento on/off.
  * Adhering to the MIDI spec, CC#84 ignores on/off.
  * This is also not a `ChannelMIDIParameter` for the same reason as `lastPortamentoNote`
  * @protected
  */
  portamentoForce = false;
  /**
  * The last pressed note on this channel in mono mode.
  * Used for tracking and releasing this note on a new Note On event.
  * -1 means none.
  * @protected
  */
  lastMonoNote = -1;
  /**
  * The last pressed note's velocity on this channel in mono mode.
  * @protected
  */
  lastMonoVelocity = 0;
  /**
  * For Mono Mode restoring notes.
  * playingNotes[midiNote]
  * @protected
  */
  playingNotes = new Array(128).fill(false);
  generators = {
    offsets: new Int16Array(GENERATORS_AMOUNT),
    offsetsEnabled: false,
    overrides: new Int16Array(GENERATORS_AMOUNT),
    overridesEnabled: false
  };
  computeModulator = computeModulator.bind(this);
  computeModulators = computeModulators.bind(this);
  /**
  * Constructs a new MIDI channel.
  * @internal
  */
  constructor(synthProps, preset, channelNumber) {
    this.synthCore = synthProps;
    this.preset = preset;
    this.channel = channelNumber;
    this._midiParameters.rxChannel = channelNumber;
    this.dynamicModulators = new DynamicModulatorManager(channelNumber);
    this.resetGeneratorOverrides();
    this.resetGeneratorOffsets();
    for (let i = 0; i < 128; i++) this.drumParams.push(new DrumParameters());
    this.resetDrumParams();
  }
  /**
  * Current amount of voices that are playing on this channel.
  */
  _voiceCount = 0;
  /**
  * Current amount of voices that are playing on this channel.
  */
  get voiceCount() {
    return this._voiceCount;
  }
  /**
  * Current amount of voices that are playing on this channel.
  * @internal
  */
  set voiceCount(value) {
    this._voiceCount = value;
  }
  /**
  * Indicates whether this channel is a drum channel.
  */
  _drumChannel = false;
  /**
  * Indicates whether this channel is a drum channel.
  */
  get drumChannel() {
    return this._drumChannel;
  }
  /**
  * An array of MIDI controllers for the channel.
  * This array is used to store the state of various MIDI controllers
  * such as volume, pan, modulation, etc.
  * @remarks
  * A bit of an explanation:
  * The controller table is stored as an int16 array, it stores 14-bit values, allowing for full 14-bit LSB resolution.
  * The only exception from this are the Registered and Non-Registered Parameter Numbers.
  * Data entries do store it!
  */
  get midiControllers() {
    return this._midiControllers;
  }
  /**
  * The channel system parameters of this channel.
  * These are only editable via the API.
  */
  get systemParameters() {
    return this._systemParameters;
  }
  /**
  * The channel MIDI parameters of this channel.
  * These are only editable via MIDI messages.
  */
  get midiParameters() {
    return this._midiParameters;
  }
  get channelSystem() {
    return this._systemParameters.presetLock ? this.lockedSystem : this.synthCore.midiParameters.system;
  }
  /**
  * Locks or unlocks a given controller.
  * This prevents any changes to it until it's unlocked.
  * @param controller The MIDI controller number (0-127).
  * @param isLocked If the controller should be locked.
  */
  lockController(controller, isLocked) {
    this.lockedControllers[controller] = isLocked;
  }
  /**
  * Changes the preset to, or from drums.
  * Note that this executes a program change.
  * @param isDrum If the channel should be a drum preset or not.
  */
  setDrums(isDrum) {
    if (BankSelectHacks.isSystemXG(this.channelSystem)) if (isDrum) {
      this.setBankMSB(BankSelectHacks.getDrumBank(this.channelSystem));
      this.setBankLSB(0);
    } else {
      if (this.channel % 16 === 9) throw new Error(`Cannot disable drums on channel ${this.channel} for XG.`);
      this.setBankMSB(0);
      this.setBankLSB(0);
    }
    else this.setGSDrums(isDrum);
    this.setDrumFlag(isDrum);
    this.programChange(this.patch.program);
  }
  /**
  * Stops all notes on the channel.
  * @param force If true, stops all notes immediately, otherwise applies release time.
  */
  stopAllNotes(force = false) {
    this.noteOnID.fill(0);
    this.noteOffID.fill(0);
    this.playingNotes.fill(false);
    if (force) {
      let vc = 0;
      if (this._voiceCount > 0) {
        for (const v of this.synthCore.voices) if (v.channel === this.channel && v.isActive) {
          v.isActive = false;
          if (++vc >= this._voiceCount) break;
        }
      }
      this.clearVoiceCount();
    } else {
      let vc = 0;
      if (this._voiceCount > 0) {
        for (const v of this.synthCore.voices) if (v.channel === this.channel && v.isActive) {
          v.releaseVoice(this.synthCore.currentTime);
          if (++vc >= this._voiceCount) break;
        }
      }
    }
    this.synthCore.callEvent("stopAll", {
      channel: this.channel,
      force
    });
  }
  /**
  * @internal
  */
  clearVoiceCount() {
    this._voiceCount = 0;
  }
  /**
  * Sets the octave tuning for a given channel.
  * @param tuning The tuning array of 12 values, each representing the tuning for a note in the octave.
  * @remarks
  * Cent tunings are relative.
  * @internal
  */
  setOctaveTuning(tuning) {
    if (tuning.length !== 12) throw new Error("Tuning is not the length of 12.");
    for (let i = 0; i < 128; i++) this.octaveTuning[i] = tuning[i % 12];
  }
  /**
  * Sets the pitch of the given channel.
  * @param pitch The pitch (0 - 16383)
  * @param midiNote The MIDI note number, pass -1 for the regular pitch wheel
  * @internal
  */
  pitchWheel(pitch, midiNote = -1) {
    if (midiNote === -1) {
      this.perNotePitch = false;
      this.setMIDIParameter("pitchWheel", pitch);
    } else {
      if (!this.perNotePitch) this.pitchWheels.fill(this._midiParameters.pitchWheel);
      this.perNotePitch = true;
      this.pitchWheels[midiNote] = pitch;
      this.computeModulatorsAll(0, ModulatorControllerSources.pitchWheel);
    }
  }
  /**
  * Sets the pressure of the given note on a specific channel.
  * This is used for polyphonic pressure (aftertouch).
  * @param midiNote 0 - 127, the MIDI note number to set the pressure for.
  * @param pressure 0 - 127, the pressure value to set for the note.
  * @internal
  */
  polyPressure(midiNote, pressure) {
    let vc = 0;
    if (this._voiceCount > 0) {
      for (const v of this.synthCore.voices) if (v.isActive && v.channel === this.channel && v.midiNote === midiNote) {
        v.pressure = pressure;
        this.computeModulators(v, 0, ModulatorControllerSources.polyPressure);
        if (++vc >= this._voiceCount) break;
      }
    }
    this.synthCore.callEvent("polyPressure", {
      channel: this.channel,
      midiNote,
      pressure
    });
  }
  /**
  * @internal
  */
  updateInternalParams() {
    const globalSystem = this.synthCore.systemParameters;
    const channelSystem = this._systemParameters;
    const globalMIDI = this.synthCore.midiParameters;
    const channelMIDI = this._midiParameters;
    const currentKeyShift = this._drumChannel ? channelSystem.keyShift : globalSystem.keyShift + globalMIDI.keyShift + channelSystem.keyShift + channelMIDI.keyShift;
    this.currentKeyShift = Math.trunc(currentKeyShift);
    this.currentTuning = this._drumChannel ? channelSystem.fineTune : globalSystem.fineTune + globalMIDI.fineTune + channelSystem.fineTune + channelMIDI.fineTune;
    const currentPanNormalized = globalSystem.pan + globalMIDI.pan + channelSystem.pan;
    this.currentPan = currentPanNormalized * 500;
    this.currentGain = SPESSASYNTH_GAIN_FACTOR * globalSystem.gain * Math.pow(globalMIDI.volume, 2) * channelSystem.gain;
  }
  /**
  * Sets the channel to a given MIDI patch.
  * Note that this executes a program change.
  * @param patch The MIDI patch to set the channel to.
  * @internal
  */
  setPatch(patch) {
    this.setBankMSB(patch.bankMSB);
    this.setBankLSB(patch.bankLSB);
    this.setGSDrums(patch.isGMGSDrum);
    this.programChange(patch.program);
  }
  /**
  * Sets the GM/GS drum flag.
  * @param drums
  * @internal
  */
  setGSDrums(drums) {
    if (drums === this.patch.isGMGSDrum) return;
    this.setBankLSB(0);
    this.setBankMSB(0);
    this.patch.isGMGSDrum = drums;
  }
  /**
  * Stops a note nearly instantly.
  * @param midiNote The note to stop.
  * @param releaseTime in timecents, defaults to -12000 (very short release).
  * @internal
  */
  killNote(midiNote, releaseTime2 = -12e3) {
    let vc = 0;
    this.noteOffID[midiNote] = 0;
    this.noteOnID[midiNote] = 0;
    if (this._voiceCount > 0) {
      for (const v of this.synthCore.voices) if (v.channel === this.channel && v.isActive && v.midiNote === midiNote) {
        v.overrideReleaseVolEnv = releaseTime2;
        v.isInRelease = false;
        v.releaseVoice(this.synthCore.currentTime);
        if (++vc >= this._voiceCount) break;
      }
    }
  }
  /**
  * Applies the `ChannelSnapshot` to this `MIDIChannel` instance.
  * @param snapshot The snapshot to apply.
  * @internal
  */
  applySnapshot(snapshot) {
    applySnapshot.call(this, snapshot);
  }
  /**
  * @internal
  */
  getSnapshot() {
    return getChannelSnapshot.call(this);
  }
  /**
  * Strictly internal, used by the sequencer for
  * very accurate portamento recreation.
  * @internal
  * @param midiNote
  */
  setLastNote(midiNote) {
    this.lastPortamentoNote = midiNote;
  }
  /**
  * @internal
  */
  destroy() {
    this.preset = void 0;
    this.lockedControllers = void 0;
    this._systemParameters = void 0;
    this._midiControllers = void 0;
    this._midiParameters = void 0;
  }
  resetGeneratorOverrides() {
    this.generators.overrides.fill(GENERATOR_OVERRIDE_NO_CHANGE_VALUE);
    this.generators.overridesEnabled = false;
  }
  setGeneratorOverride(gen, value, realtime = false) {
    this.generators.overrides[gen] = value;
    this.generators.overridesEnabled = true;
    if (realtime) {
      let vc = 0;
      if (this._voiceCount > 0) {
        for (const v of this.synthCore.voices) if (v.channel === this.channel && v.isActive) {
          v.generators[gen] = value;
          this.computeModulators(v);
          if (++vc >= this._voiceCount) break;
        }
      }
    }
  }
  resetGeneratorOffsets() {
    this.generators.offsets.fill(0);
    this.generators.offsetsEnabled = false;
  }
  setGeneratorOffset(gen, value) {
    this.generators.offsets[gen] = value * GeneratorLimits[gen].nrpn;
    this.generators.offsetsEnabled = true;
    let vc = 0;
    if (this._voiceCount > 0) {
      for (const v of this.synthCore.voices) if (v.channel === this.channel && v.isActive) {
        this.computeModulators(v);
        if (++vc >= this._voiceCount) break;
      }
    }
  }
  resetDrumParams() {
    if (this.synthCore.systemParameters.drumLock || !this._drumChannel) return;
    for (let i = 0; i < 128; i++) {
      const p = this.drumParams[i];
      p.pitch = 0;
      p.gain = 1;
      p.exclusiveClass = 0;
      p.pan = 64;
      p.reverbGain = DEFAULT_DRUM_REVERB[i] / 127;
      p.chorusGain = this.channelSystem === "xg" ? DEFAULT_DRUM_REVERB[i] / 127 : 0;
      p.delayGain = 0;
      p.rxNoteOn = true;
      p.rxNoteOff = false;
    }
  }
  computeModulatorsAll(sourceUsesCC, sourceIndex) {
    let vc = 0;
    if (this._voiceCount > 0) {
      for (const v of this.synthCore.voices) if (v.channel === this.channel && v.isActive) {
        this.computeModulators(v, sourceUsesCC, sourceIndex);
        if (++vc >= this._voiceCount) break;
      }
    }
  }
  setBankMSB(bankMSB) {
    if (this._systemParameters.presetLock) return;
    this.patch.bankMSB = bankMSB;
  }
  setBankLSB(bankLSB) {
    if (this._systemParameters.presetLock) return;
    this.patch.bankLSB = bankLSB;
  }
  /**
  * Sets drums on channel.
  */
  setDrumFlag(isDrum) {
    if (this._systemParameters.presetLock || !this.preset || this._drumChannel === isDrum) return;
    this._drumChannel = isDrum;
    this.updateInternalParams();
  }
};
var SoundBankManagerPreset = class extends BasicPreset {
  constructor(p, offset) {
    super(p.parentSoundBank, p.globalZone);
    this.bankMSB = BankSelectHacks.addBankOffset(p.bankMSB, offset, true);
    this.name = p.name;
    this.bankLSB = p.bankLSB;
    this.isGMGSDrum = p.isGMGSDrum;
    this.program = p.program;
    this.genre = p.genre;
    this.morphology = p.morphology;
    this.library = p.library;
    this.zones = p.zones;
  }
};
var SoundBankManager = class {
  /**
  * All the sound banks, ordered from the most important to the least.
  */
  soundBankList = [];
  presetListChangeCallback;
  selectablePresetList = [];
  /**
  * @param presetListChangeCallback Supplied by the parent synthesizer class,
  * this is called whenever the preset list changes.
  */
  constructor(presetListChangeCallback) {
    this.presetListChangeCallback = presetListChangeCallback;
  }
  _presetList = [];
  /**
  * The list of all presets in the sound bank stack.
  */
  get presetList() {
    return [...this._presetList];
  }
  /**
  * The current sound bank priority order.
  * @returns The IDs of the sound banks in the current order.
  */
  get priorityOrder() {
    return this.soundBankList.map((s) => s.id);
  }
  /**
  * The current sound bank priority order.
  * @param newList The new order of sound bank IDs.
  */
  set priorityOrder(newList) {
    this.soundBankList.sort((a, b) => newList.indexOf(a.id) - newList.indexOf(b.id));
    this.generatePresetList();
  }
  /**
  * Deletes a given sound bank by its ID.
  * @param id the ID of the sound bank to delete.
  */
  deleteSoundBank(id) {
    if (this.soundBankList.length === 0) {
      SpessaLog.warn("1 soundbank left. Aborting!");
      return;
    }
    const index = this.soundBankList.findIndex((s) => s.id === id);
    if (index === -1) throw new Error(`No sound bank with id "${id}"`);
    this.soundBankList.splice(index, 1);
    this.generatePresetList();
  }
  /**
  * Adds a new sound bank with a given ID, or replaces an existing one.
  * @param font the sound bank to add.
  * @param id the ID of the sound bank.
  * @param bankOffset the bank offset of the sound bank.
  */
  addSoundBank(font, id, bankOffset = 0) {
    const foundBank = this.soundBankList.find((s) => s.id === id);
    if (foundBank === void 0) this.soundBankList.push({
      id,
      soundBank: font,
      bankOffset
    });
    else {
      foundBank.soundBank = font;
      foundBank.bankOffset = bankOffset;
    }
    this.generatePresetList();
  }
  /**
  * Gets a given preset from the sound bank stack.
  * @param patch The MIDI patch to search for.
  * @param system The MIDI system to select the preset for.
  * @returns An object containing the preset and its bank offset.
  * @internal
  */
  getPreset(patch, system) {
    if (this.soundBankList.length === 0 || this.selectablePresetList.length === 0) return;
    return MIDIPatchTools.selectPatch(this.selectablePresetList, patch, system);
  }
  destroy() {
    for (const s of this.soundBankList) s.soundBank.destroySoundBank();
    this.soundBankList = [];
  }
  generatePresetList() {
    const presetList = new Array();
    const addedPresets = /* @__PURE__ */ new Set();
    for (const s of this.soundBankList) {
      const bank = s.soundBank;
      const bankOffset = s.bankOffset;
      for (const p of bank.presets) {
        const selectablePreset = new SoundBankManagerPreset(p, bankOffset);
        if (!addedPresets.has(selectablePreset.toMIDIString())) {
          addedPresets.add(selectablePreset.toMIDIString());
          presetList.push(selectablePreset);
        }
      }
    }
    presetList.sort(MIDIPatchTools.compare.bind(MIDIPatchTools));
    this.selectablePresetList = presetList;
    this._presetList = presetList.map((p) => {
      return {
        bankMSB: p.bankMSB,
        bankLSB: p.bankLSB,
        program: p.program,
        isGMGSDrum: p.isGMGSDrum,
        name: p.name,
        isDrum: p.isDrum
      };
    });
    this.presetListChangeCallback();
  }
};
function getTuning(byte1, byte2, byte3) {
  const midiNote = byte1;
  const fraction = byte2 << 7 | byte3;
  if (byte1 === 127 && byte2 === 127 && byte3 === 127) return -1;
  return midiNote + fraction * 61e-6;
}
function universalSystemExclusive(syx, channelOffset = 0) {
  switch (syx[2]) {
    case 4:
      switch (syx[3]) {
        default:
          SpessaLog.gmFail("Device Control", syx);
          break;
        case 1: {
          const vol = syx[5] << 7 | syx[4];
          this.setMIDIParameter("volume", vol / 16383);
          SpessaLog.gmInfo("Master Volume", vol);
          break;
        }
        case 2: {
          const pan = ((syx[5] << 7 | syx[4]) - 8192) / 8192;
          this.setMIDIParameter("pan", pan);
          SpessaLog.gmInfo("Master Balance", pan);
          break;
        }
        case 3: {
          const cents = ((syx[5] << 7 | syx[4]) - 8192) / 81.92;
          this.setMIDIParameter("fineTune", cents);
          SpessaLog.gmInfo("Master Fine Tuning", cents, "cents");
          break;
        }
        case 4: {
          const keyShift = syx[5] - 64;
          this.setMIDIParameter("keyShift", keyShift);
          SpessaLog.gmInfo("Master Coarse Tuning", keyShift, "keys");
          break;
        }
        case 5:
          if (syx[4] !== 1 || syx[5] !== 1 || syx[6] !== 1 || syx[7] !== 1) {
            SpessaLog.gmFail("Global Parameter Control", syx);
            break;
          }
          switch (syx[8]) {
            default:
              SpessaLog.gmFail("Global Parameter Control", syx);
              break;
            case 1: {
              const value = syx[10];
              switch (syx[9]) {
                default:
                  SpessaLog.gmFail("Reverb Parameter Control", syx);
                  break;
                case 0: {
                  const macro = value === 8 ? 5 : value;
                  this.setReverbMacro(macro);
                  SpessaLog.gmInfo("Reverb Type", macro);
                  break;
                }
                case 1:
                  this.reverbProcessor.time = value;
                  SpessaLog.gmInfo("Reverb Time", value);
              }
              break;
            }
            case 2: {
              const value = syx[10];
              switch (syx[9]) {
                default:
                  SpessaLog.gmFail("Chorus Parameter Control", syx);
                  break;
                case 0:
                  this.setChorusMacro(value);
                  SpessaLog.gmInfo("Chorus Type", value);
                  break;
                case 1:
                  this.chorusProcessor.rate = value;
                  SpessaLog.gmInfo("Chorus Mod Rate", value);
                  break;
                case 2:
                  this.chorusProcessor.depth = value;
                  SpessaLog.gmInfo("Chorus Mod Depth", value);
                  break;
                case 3:
                  this.chorusProcessor.feedback = value;
                  SpessaLog.gmInfo("Chorus Mod Feedback", value);
                  break;
                case 4:
                  this.chorusProcessor.sendLevelToReverb = value;
                  SpessaLog.gmInfo("Chorus Send to Reverb", value);
                  break;
              }
            }
          }
      }
      break;
    case 9:
      switch (syx[3]) {
        default:
          SpessaLog.gmFail("System Exclusive", syx);
          break;
        case 1:
          SpessaLog.coolInfo("MIDI System", "General MIDI 1");
          this.reset("gm");
          break;
        case 2:
          SpessaLog.coolInfo("MIDI System", "Roland GS");
          this.reset("gs");
          break;
        case 3:
          SpessaLog.coolInfo("MIDI System", "General MIDI 2");
          this.reset("gm2");
          break;
      }
      break;
    case 8: {
      let currentMessageIndex = 4;
      switch (syx[3]) {
        case 1: {
          const program = syx[currentMessageIndex++];
          const tuningName = readBinaryString(syx, 16, currentMessageIndex);
          currentMessageIndex += 16;
          if (syx.length < 384) {
            SpessaLog.warn(`The Bulk Tuning Dump is too short! (${syx.length} bytes, at least 384 are expected)`);
            return;
          }
          for (let midiNote = 0; midiNote < 128; midiNote++) this.tunings[program * 128 + midiNote] = getTuning(syx[currentMessageIndex++], syx[currentMessageIndex++], syx[currentMessageIndex++]);
          SpessaLog.gmInfo("Bulk Tuning Dump", `${tuningName}, program ${program}`);
          break;
        }
        case 2:
        case 7: {
          if (syx[3] === 7) currentMessageIndex++;
          const tuningProgram = syx[currentMessageIndex++];
          const numberOfChanges = syx[currentMessageIndex++];
          for (let i = 0; i < numberOfChanges; i++) {
            const midiNote = syx[currentMessageIndex++];
            this.tunings[tuningProgram * 128 + midiNote] = getTuning(syx[currentMessageIndex++], syx[currentMessageIndex++], syx[currentMessageIndex++]);
          }
          SpessaLog.gmInfo("Single Note Tuning", `program: ${tuningProgram}. Keys affected: ${numberOfChanges}`);
          break;
        }
        case 9:
        case 8: {
          const newOctaveTuning = new Int8Array(12);
          if (syx[3] === 8) for (let i = 0; i < 12; i++) newOctaveTuning[i] = syx[7 + i] - 64;
          else for (let i = 0; i < 24; i += 2) {
            const tuning = (syx[7 + i] << 7 | syx[8 + i]) - 8192;
            newOctaveTuning[i / 2] = Math.floor(tuning / 81.92);
          }
          if ((syx[4] & 1) === 1) this.midiChannels[14 + channelOffset].setOctaveTuning(newOctaveTuning);
          if ((syx[4] >> 1 & 1) === 1) this.midiChannels[15 + channelOffset].setOctaveTuning(newOctaveTuning);
          for (let i = 0; i < 7; i++) if ((syx[5] >> i & 1) === 1) this.midiChannels[7 + i + channelOffset].setOctaveTuning(newOctaveTuning);
          for (let i = 0; i < 7; i++) if ((syx[6] >> i & 1) === 1) this.midiChannels[i + channelOffset].setOctaveTuning(newOctaveTuning);
          SpessaLog.gmInfo("Octave Scale Tuning", newOctaveTuning.join(" "));
          break;
        }
        default:
          SpessaLog.gmFail("MIDI Tuning Standard", syx);
          break;
      }
      break;
    }
    default:
      SpessaLog.gmFail("Universal System Exclusive", syx);
  }
}
function rolandSystemExclusive(syx, channelOffset = 0) {
  if (syx[3] === 18) switch (syx[2]) {
    case 66: {
      const a1 = syx[4];
      const a2 = syx[5];
      const a3 = syx[6];
      const data = Math.min(syx[7], 127);
      if (a1 === 0 && a2 === 0 && a3 === 127 && (data === 0 || data === 1)) {
        if (data === 1) {
          SpessaLog.gsInfo("Mode", "Double Module");
          while (this.midiChannels.length < 32) this.createMIDIChannel(true);
        }
        SpessaLog.coolInfo("MIDI System", "Roland GS");
        this.reset("gs");
        return;
      }
      if (a1 === 64 || a1 === 80) {
        if (a1 === 80) channelOffset += 16;
        if (a2 === 0) {
          switch (a3) {
            case 0: {
              const cents = ((data << 12 | syx[8] << 8 | syx[9] << 4 | syx[10]) - 1024) / 10;
              this.setMIDIParameter("fineTune", cents);
              SpessaLog.gsInfo("Master Tune", cents, "cents");
              break;
            }
            case 4:
              SpessaLog.gsInfo("Master Volume", data);
              this.setMIDIParameter("volume", data / 127);
              break;
            case 5: {
              const transpose = data - 64;
              SpessaLog.gsInfo("Master Key-Shift", transpose, "keys");
              this.setMIDIParameter("keyShift", transpose);
              break;
            }
            case 6: {
              const pan = (data - 64) / 63;
              SpessaLog.gsInfo("Master Pan", pan);
              this.setMIDIParameter("pan", pan);
              break;
            }
            case 127:
              if (data === 0) {
                SpessaLog.coolInfo("MIDI System", "Roland GS");
                this.reset("gs");
              } else if (data === 127) {
                SpessaLog.coolInfo("MIDI System", "General MIDI 1");
                this.reset("gm");
              }
              break;
            default:
              SpessaLog.gsFail("System Parameter", syx);
              break;
          }
          return;
        }
        if (a2 === 1) {
          const isReverb = a3 >= 48 && a3 <= 55;
          const isChorus = a3 >= 56 && a3 <= 64;
          const isDelay = a3 >= 80 && a3 <= 90;
          if (isReverb && this.systemParameters.reverbLock) return;
          if (isChorus && this.systemParameters.chorusLock) return;
          if (isDelay && this.systemParameters.delayLock) return;
          this.delayActive ||= a3 === 64 || isDelay;
          switch (a3) {
            default:
              SpessaLog.gsFail("Patch Common Parameter", [a3]);
              break;
            case 0: {
              const patchName = readBinaryString(syx, 16, 7);
              SpessaLog.gsInfo("Patch name", patchName);
              this.callEvent("displayMessage", [...syx]);
              break;
            }
            case 48:
              this.setReverbMacro(data);
              SpessaLog.gsInfo("Reverb Macro", data);
              break;
            case 49:
              this.reverbProcessor.character = data;
              SpessaLog.gsInfo("Reverb Character", data);
              this.callEvent("effectChange", {
                effect: "reverb",
                parameter: "character",
                value: data
              });
              break;
            case 50:
              this.reverbProcessor.preLowpass = data;
              SpessaLog.gsInfo("Reverb Pre-LPF", data);
              this.callEvent("effectChange", {
                effect: "reverb",
                parameter: "preLowpass",
                value: data
              });
              break;
            case 51:
              this.reverbProcessor.level = data;
              SpessaLog.gsInfo("Reverb Level", data);
              this.callEvent("effectChange", {
                effect: "reverb",
                parameter: "level",
                value: data
              });
              break;
            case 52:
              this.reverbProcessor.time = data;
              SpessaLog.gsInfo("Reverb Time", data);
              this.callEvent("effectChange", {
                effect: "reverb",
                parameter: "time",
                value: data
              });
              break;
            case 53:
              this.reverbProcessor.delayFeedback = data;
              SpessaLog.gsInfo("Reverb Delay Feedback", data);
              this.callEvent("effectChange", {
                effect: "reverb",
                parameter: "delayFeedback",
                value: data
              });
              break;
            case 54:
              break;
            case 55:
              this.reverbProcessor.preDelayTime = data;
              SpessaLog.gsInfo("Reverb Predelay Time", data);
              this.callEvent("effectChange", {
                effect: "reverb",
                parameter: "preDelayTime",
                value: data
              });
              break;
            case 56:
              this.setChorusMacro(data);
              SpessaLog.gsInfo("Chorus Macro", data);
              break;
            case 57:
              this.chorusProcessor.preLowpass = data;
              SpessaLog.gsInfo("Chorus Pre-LPF", data);
              this.callEvent("effectChange", {
                effect: "chorus",
                parameter: "preLowpass",
                value: data
              });
              break;
            case 58:
              this.chorusProcessor.level = data;
              SpessaLog.gsInfo("Chorus Level", data);
              this.callEvent("effectChange", {
                effect: "chorus",
                parameter: "level",
                value: data
              });
              break;
            case 59:
              this.chorusProcessor.feedback = data;
              SpessaLog.gsInfo("Chorus Feedback", data);
              this.callEvent("effectChange", {
                effect: "chorus",
                parameter: "feedback",
                value: data
              });
              break;
            case 60:
              this.chorusProcessor.delay = data;
              SpessaLog.gsInfo("Chorus Delay", data);
              this.callEvent("effectChange", {
                effect: "chorus",
                parameter: "delay",
                value: data
              });
              break;
            case 61:
              this.chorusProcessor.rate = data;
              SpessaLog.gsInfo("Chorus Rate", data);
              this.callEvent("effectChange", {
                effect: "chorus",
                parameter: "rate",
                value: data
              });
              break;
            case 62:
              this.chorusProcessor.depth = data;
              SpessaLog.gsInfo("Chorus Depth", data);
              this.callEvent("effectChange", {
                effect: "chorus",
                parameter: "depth",
                value: data
              });
              break;
            case 63:
              this.chorusProcessor.sendLevelToReverb = data;
              SpessaLog.gsInfo("Chorus Send Level To Reverb", data);
              this.callEvent("effectChange", {
                effect: "chorus",
                parameter: "sendLevelToReverb",
                value: data
              });
              break;
            case 64:
              this.chorusProcessor.sendLevelToDelay = data;
              SpessaLog.gsInfo("Chorus Send Level To Delay", data);
              this.callEvent("effectChange", {
                effect: "chorus",
                parameter: "sendLevelToDelay",
                value: data
              });
              break;
            case 80:
              this.setDelayMacro(data);
              SpessaLog.gsInfo("Delay Macro", data);
              break;
            case 81:
              this.delayProcessor.preLowpass = data;
              SpessaLog.gsInfo("Delay Pre-LPF", data);
              this.callEvent("effectChange", {
                effect: "delay",
                parameter: "preLowpass",
                value: data
              });
              break;
            case 82:
              this.delayProcessor.timeCenter = data;
              SpessaLog.gsInfo("Delay Time Center", data);
              this.callEvent("effectChange", {
                effect: "delay",
                parameter: "timeCenter",
                value: data
              });
              break;
            case 83:
              this.delayProcessor.timeRatioLeft = data;
              SpessaLog.gsInfo("Delay Time Ratio Left", data);
              this.callEvent("effectChange", {
                effect: "delay",
                parameter: "timeRatioLeft",
                value: data
              });
              break;
            case 84:
              this.delayProcessor.timeRatioRight = data;
              SpessaLog.gsInfo("Delay Time Ratio Right", data);
              this.callEvent("effectChange", {
                effect: "delay",
                parameter: "timeRatioRight",
                value: data
              });
              break;
            case 85:
              this.delayProcessor.levelCenter = data;
              SpessaLog.gsInfo("Delay Level Center", data);
              this.callEvent("effectChange", {
                effect: "delay",
                parameter: "levelCenter",
                value: data
              });
              break;
            case 86:
              this.delayProcessor.levelLeft = data;
              SpessaLog.gsInfo("Delay Level Left", data);
              this.callEvent("effectChange", {
                effect: "delay",
                parameter: "levelLeft",
                value: data
              });
              break;
            case 87:
              this.delayProcessor.levelRight = data;
              SpessaLog.gsInfo("Delay Level Right", data);
              this.callEvent("effectChange", {
                effect: "delay",
                parameter: "levelRight",
                value: data
              });
              break;
            case 88:
              this.delayProcessor.level = data;
              SpessaLog.gsInfo("Delay Level", data);
              this.callEvent("effectChange", {
                effect: "delay",
                parameter: "level",
                value: data
              });
              break;
            case 89:
              this.delayProcessor.feedback = data;
              SpessaLog.gsInfo("Delay Feedback", data);
              this.callEvent("effectChange", {
                effect: "delay",
                parameter: "feedback",
                value: data
              });
              break;
            case 90:
              this.delayProcessor.sendLevelToReverb = data;
              SpessaLog.gsInfo("Delay Send Level To Reverb", data);
              this.callEvent("effectChange", {
                effect: "delay",
                parameter: "sendLevelToReverb",
                value: data
              });
              break;
          }
          break;
        }
        if (a2 === 3) {
          if (this.systemParameters.insertionEffectLock) return;
          if (a3 >= 3 && a3 <= 25) this.insertionParams[a3 - 3] = data;
          if (a3 >= 3 && a3 <= 22) {
            this.insertionProcessor.setParameter(a3, data);
            SpessaLog.gsInfo(`EFX Parameter ${a3 - 2}`, data);
            this.callEvent("effectChange", {
              effect: "insertion",
              parameter: a3,
              value: data
            });
            return;
          }
          switch (a3) {
            default:
              SpessaLog.gsFail("Insertion Effect", [a3]);
              return;
            case 0: {
              const type = data << 8 | syx[8];
              const proc = this.insertionEffects.get(type);
              if (proc) {
                SpessaLog.gsInfo("EFX Type", type.toString(16));
                this.insertionProcessor = proc;
              } else {
                this.insertionProcessor = this.insertionFallback;
                SpessaLog.gsFail("EFX Processor", [type], "Using Thru.");
              }
              this.resetInsertionParams();
              this.insertionProcessor.reset();
              this.callEvent("effectChange", {
                effect: "insertion",
                parameter: 0,
                value: type
              });
              return;
            }
            case 23:
              this.insertionProcessor.sendLevelToReverb = data / 127 * EFX_SENDS_GAIN_CORRECTION;
              SpessaLog.gsInfo("EFX Send Level to Reverb", data);
              this.callEvent("effectChange", {
                effect: "insertion",
                parameter: a3,
                value: data
              });
              return;
            case 24:
              this.insertionProcessor.sendLevelToChorus = data / 127 * EFX_SENDS_GAIN_CORRECTION;
              SpessaLog.gsInfo("EFX Send Level to Chorus", data);
              this.callEvent("effectChange", {
                effect: "insertion",
                parameter: a3,
                value: data
              });
              return;
            case 25:
              this.insertionProcessor.sendLevelToDelay = data / 127 * EFX_SENDS_GAIN_CORRECTION;
              this.delayActive = true;
              SpessaLog.gsInfo("EFX Send Level to Delay", data);
              this.callEvent("effectChange", {
                effect: "insertion",
                parameter: a3,
                value: data
              });
              return;
          }
        }
        if (a2 >> 4 === 1) {
          const channel = MIDIUtils.syxToChannel(a2 & 15) + channelOffset;
          const ch = this.midiChannels[channel];
          if (!ch) SpessaLog.gsFail(`Patch Parameter for ${channel}`, syx, "Invalid channel number");
          switch (a3) {
            default:
              SpessaLog.gsFail(`Patch Part Parameter for ${channel}`, [a3]);
              return;
            case 0:
              ch.controllerChange(MIDIControllers.bankSelect, data);
              ch.programChange(syx[8]);
              break;
            case 2: {
              const rxChannel = data === 16 ? -1 : data + channelOffset;
              ch.setMIDIParameter("rxChannel", rxChannel);
              this.customChannelNumbers ||= rxChannel !== ch.channel;
              SpessaLog.gsInfo(`Rx. Channel on ${channel}`, rxChannel);
              break;
            }
            case 19:
              ch.setMIDIParameter("polyMode", data === 1);
              SpessaLog.gsInfo(`Mono/poly on ${channel}`, ch.midiParameters.polyMode ? "POLY" : "MONO");
              break;
            case 20:
              ch.setMIDIParameter("assignMode", data);
              SpessaLog.gsInfo(`Assign mode on ${channel}`, data);
              break;
            case 21: {
              ch.setMIDIParameter("drumMap", data);
              const isDrums = data > 0;
              ch.setGSDrums(isDrums);
              SpessaLog.gsInfo(`Drums on ${channel}`, isDrums.toString());
              return;
            }
            case 22: {
              const keyShift = data - 64;
              ch.setMIDIParameter("keyShift", keyShift);
              SpessaLog.gsInfo(`Key Shift for ${channel}`, keyShift);
              return;
            }
            case 25:
              ch.controllerChange(MIDIControllers.mainVolume, data);
              return;
            case 26:
              ch.setMIDIParameter("velocitySenseDepth", data);
              SpessaLog.gsInfo(`Velocity Sense Depth for ${channel}`, data);
              return;
            case 27:
              ch.setMIDIParameter("velocitySenseOffset", data);
              SpessaLog.gsInfo(`Velocity Sense Offset for ${channel}`, data);
              return;
            case 28: {
              const panPosition = data;
              const randomPan = panPosition === 0;
              ch.setMIDIParameter("randomPan", randomPan);
              if (randomPan) SpessaLog.gsInfo(`Random pan on ${channel}`, "ON");
              else ch.controllerChange(MIDIControllers.pan, panPosition);
              break;
            }
            case 31:
              ch.setMIDIParameter("cc1", data);
              SpessaLog.gsInfo(`CC1 Controller Number for ${channel}`, data);
              break;
            case 32:
              ch.setMIDIParameter("cc2", data);
              SpessaLog.gsInfo(`CC2 Controller Number for ${channel}`, data);
              break;
            case 33:
              ch.controllerChange(MIDIControllers.chorusDepth, data);
              break;
            case 34:
              ch.controllerChange(MIDIControllers.reverbDepth, data);
              break;
            case 42: {
              const cents = ((data << 7 | syx[8]) - 8192) / 81.92;
              ch.setMIDIParameter("fineTune", cents);
              SpessaLog.gsInfo(`Fine tuning for ${channel}`, Math.round(cents), "cents");
              break;
            }
            case 44:
              ch.controllerChange(MIDIControllers.variationDepth, data);
              break;
            case 48:
              ch.controllerChange(MIDIControllers.vibratoRate, data);
              break;
            case 49:
              ch.controllerChange(MIDIControllers.vibratoDepth, data);
              break;
            case 50:
              ch.controllerChange(MIDIControllers.brightness, data);
              break;
            case 51:
              ch.controllerChange(MIDIControllers.filterResonance, data);
              break;
            case 52:
              ch.controllerChange(MIDIControllers.attackTime, data);
              break;
            case 53:
              ch.controllerChange(MIDIControllers.decayTime, data);
              break;
            case 54:
              ch.controllerChange(MIDIControllers.releaseTime, data);
              break;
            case 55:
              ch.controllerChange(MIDIControllers.vibratoDelay, data);
              break;
            case 64: {
              const tuningBytes = syx.length - 9;
              const newTuning = new Int8Array(12);
              for (let i = 0; i < tuningBytes; i++) newTuning[i] = syx[i + 7] - 64;
              ch.setOctaveTuning(newTuning);
              SpessaLog.gsInfo(`Octave Scale Tuning for ${channel}`, newTuning.join(", "));
              break;
            }
          }
          return;
        }
        if (a2 >> 4 === 2) {
          const channel = MIDIUtils.syxToChannel(a2 & 15) + channelOffset;
          const ch = this.midiChannels[channel];
          switch (a3 & 240) {
            default:
              SpessaLog.gsFail(`Patch Parameter Controller for ${channel}`, [a3 & 240]);
              break;
            case 0:
              if ((a3 & 15) === 4) {
                const cents = data / 127 * 600;
                ch.setMIDIParameter("modulationDepth", cents);
                SpessaLog.gsInfo(`Modulation depth for ${channel}`, Math.round(cents), "cents");
                break;
              }
              ch.dynamicModulators.setupReceiver(a3, data, MIDIControllers.modulationWheel, true, "mod wheel");
              break;
            case 16:
              if ((a3 & 15) === 0) {
                const centeredValue = data - 64;
                ch.setMIDIParameter("pitchWheelRange", centeredValue);
                SpessaLog.gsInfo(`Pitch Wheel Range for ${channel}`, centeredValue, "semitones");
                break;
              }
              ch.dynamicModulators.setupReceiver(a3, data, ModulatorControllerSources.pitchWheel, false, "pitch wheel", true);
              break;
            case 32:
              ch.dynamicModulators.setupReceiver(a3, data, ModulatorControllerSources.channelPressure, false, "channel pressure");
              break;
            case 48:
              ch.dynamicModulators.setupReceiver(a3, data, ModulatorControllerSources.polyPressure, false, "poly pressure");
              break;
            case 64:
              ch.dynamicModulators.setupReceiver(a3, data, ch.midiParameters.cc1, true, "CC1");
              break;
            case 80:
              ch.dynamicModulators.setupReceiver(a3, data, ch.midiParameters.cc2, true, "CC2");
          }
          return;
        }
        if (a2 >> 4 === 4) {
          const channel = MIDIUtils.syxToChannel(a2 & 15) + channelOffset;
          const ch = this.midiChannels[channel];
          switch (a3) {
            default:
              SpessaLog.gsFail("Patch Part Parameter", [a3]);
              break;
            case 0:
            case 1:
              ch.controllerChange(MIDIControllers.bankSelectLSB, data);
              break;
            case 34: {
              const efx = data === 1;
              ch.setMIDIParameter("efxAssign", efx);
              this.insertionActive ||= efx;
              SpessaLog.gsInfo(`EFX assign for ${channel}`, efx ? "EFX" : "BYPASS");
            }
          }
          return;
        }
        SpessaLog.gsFail("Patch Parameter", syx);
        return;
      }
      if (a1 === 65 || a1 === 81) {
        if (this.systemParameters.drumLock) return;
        const map = (a2 >> 4) + 1;
        const drumKey = a3;
        const param = a2 & 15;
        switch (param) {
          default:
            SpessaLog.gsFail("Drum Setup", [param]);
            return;
          case 0: {
            const patchName = readBinaryString(syx, 12, 7);
            SpessaLog.gsInfo(`Drum Map Name for MAP${map}`, patchName);
            this.callEvent("displayMessage", [...syx]);
            break;
          }
          case 1: {
            const pitch = data - 60;
            for (const ch of this.midiChannels) {
              if (ch.midiParameters.drumMap !== map) continue;
              ch.drumParams[drumKey].pitch = pitch * (ch.patch.bankLSB === 1 ? 100 : 50);
            }
            SpessaLog.gsInfo(`Drum Pitch for MAP${map}, key ${drumKey}`, pitch);
            break;
          }
          case 2:
            for (const ch of this.midiChannels) {
              if (ch.midiParameters.drumMap !== map) continue;
              ch.drumParams[drumKey].gain = data / 120;
            }
            SpessaLog.gsInfo(`Drum Level for MAP${map}, key ${drumKey}`, data);
            break;
          case 3:
            for (const ch of this.midiChannels) {
              if (ch.midiParameters.drumMap !== map) continue;
              ch.drumParams[drumKey].exclusiveClass = data;
            }
            SpessaLog.gsInfo(`Drum Assign Group for MAP${map}, key ${drumKey}`, data);
            break;
          case 4:
            for (const ch of this.midiChannels) {
              if (ch.midiParameters.drumMap !== map) continue;
              ch.drumParams[drumKey].pan = data;
            }
            SpessaLog.gsInfo(`Drum Pan for MAP${map}, key ${drumKey}`, data);
            break;
          case 5:
            for (const ch of this.midiChannels) {
              if (ch.midiParameters.drumMap !== map) continue;
              ch.drumParams[drumKey].reverbGain = data / 127;
            }
            SpessaLog.gsInfo(`Drum Reverb for MAP${map}, key ${drumKey}`, data);
            break;
          case 6:
            for (const ch of this.midiChannels) {
              if (ch.midiParameters.drumMap !== map) continue;
              ch.drumParams[drumKey].chorusGain = data / 127;
            }
            SpessaLog.gsInfo(`Drum Chorus for MAP${map}, key ${drumKey}`, data);
            break;
          case 7:
            for (const ch of this.midiChannels) {
              if (ch.midiParameters.drumMap !== map) continue;
              ch.drumParams[drumKey].rxNoteOff = data === 1;
            }
            SpessaLog.gsInfo(`Drum Note Off for MAP${map}, key ${drumKey}`, data === 1 ? "ON" : "OFF");
            break;
          case 8:
            for (const ch of this.midiChannels) {
              if (ch.midiParameters.drumMap !== map) continue;
              ch.drumParams[drumKey].rxNoteOn = data === 1;
            }
            SpessaLog.gsInfo(`Drum Note On for MAP${map}, key ${drumKey}`, data === 1 ? "ON" : "OFF");
            break;
          case 9:
            for (const ch of this.midiChannels) {
              if (ch.midiParameters.drumMap !== map) continue;
              ch.drumParams[drumKey].delayGain = data / 127;
            }
            SpessaLog.gsInfo(`Drum Delay for MAP${map}, key ${drumKey}`, data);
            break;
        }
        return;
      }
      SpessaLog.gsFail("System Exclusive", syx);
      return;
    }
    case 69:
      if (syx[4] === 16) this.callEvent("displayMessage", [...syx]);
      return;
    case 22:
      if (syx[4] === 16) {
        this.setMIDIParameter("volume", syx[7] / 100);
        SpessaLog.coolInfo("Roland Master Volume Control", syx[7]);
        return;
      } else SpessaLog.unsupported("Roland", syx);
  }
  else {
    SpessaLog.unsupported("Roland", syx);
    return;
  }
}
function yamahaSystemExclusive(syx, channelOffset = 0) {
  if (syx[2] === 76) {
    const a1 = syx[3];
    const a2 = syx[4];
    const a3 = syx[5];
    const data = syx[6];
    if (a1 === 0 && a2 === 0) {
      switch (a3) {
        case 0:
          {
            const cents = (((syx[6] & 15) << 12 | (syx[7] & 15) << 8 | (syx[8] & 15) << 4 | syx[9] & 15) - 1024) / 10;
            this.setMIDIParameter("fineTune", cents);
            SpessaLog.xgInfo("Master Tune", cents, "cents");
          }
          break;
        case 4:
          this.setMIDIParameter("volume", data / 127);
          SpessaLog.xgInfo("Master Volume", data);
          break;
        case 5: {
          const vol = 127 - data;
          this.setMIDIParameter("volume", vol / 127);
          SpessaLog.xgInfo("Master Attenuation", data);
          break;
        }
        case 6: {
          const transpose = data - 64;
          this.setMIDIParameter("keyShift", transpose);
          SpessaLog.xgInfo("Master Transpose", data);
          break;
        }
        case 127:
        case 126:
          SpessaLog.coolInfo("MIDI System", "Yamaha XG");
          this.reset("xg");
          break;
      }
      return;
    }
    if (a1 === 2 && a2 === 1) {
      let effectType;
      const effect = a3;
      if (effect <= 21) effectType = "Reverb";
      else if (effect <= 53) effectType = "Chorus";
      else effectType = "Variation";
      SpessaLog.xgFail(`${effectType} parameter`, [effect]);
      return;
    }
    if (a1 === 8) {
      const channel = a2 + channelOffset;
      if (channel >= this.midiChannels.length) {
        SpessaLog.xgFail("Part Setup", syx, `Invalid part number: ${channel}`);
        return;
      }
      const ch = this.midiChannels[channel];
      switch (a3) {
        default:
          SpessaLog.xgFail("Part Setup", [syx[5]]);
          break;
        case 1:
          ch.controllerChange(MIDIControllers.bankSelect, data);
          break;
        case 2:
          ch.controllerChange(MIDIControllers.bankSelectLSB, data);
          break;
        case 3:
          ch.programChange(data);
          break;
        case 4: {
          const rxChannel = data + channelOffset;
          ch.setMIDIParameter("rxChannel", rxChannel);
          this.customChannelNumbers ||= rxChannel !== ch.channel;
          SpessaLog.xgInfo(`Rev. Channel on ${channel}`, rxChannel);
          break;
        }
        case 5: {
          const poly = data === 1;
          ch.setMIDIParameter("polyMode", poly);
          SpessaLog.xgInfo(`Mono/poly on ${channel}`, poly ? "POLY" : "MONO");
          break;
        }
        case 6:
          ch.setMIDIParameter("assignMode", data);
          SpessaLog.xgInfo(`Same Note Number Key On Assign on ${channel}`, data);
          break;
        case 7: {
          const drums = data !== 0;
          ch.setDrums(drums);
          SpessaLog.xgInfo(`Part Mode on ${channel}`, drums ? "DRUM" : "MELODIC");
          break;
        }
        case 8: {
          const keyShift = data - 64;
          ch.setMIDIParameter("keyShift", keyShift);
          SpessaLog.xgInfo(`Key Shift on ${channel}`, keyShift);
          break;
        }
        case 11:
          ch.controllerChange(MIDIControllers.mainVolume, data);
          break;
        case 12:
          ch.setMIDIParameter("velocitySenseDepth", data);
          SpessaLog.xgInfo(`Velocity Sense Depth on ${channel}`, data);
          return;
        case 13:
          ch.setMIDIParameter("velocitySenseOffset", data);
          SpessaLog.xgInfo(`Velocity Sense Offset on ${channel}`, data);
          return;
        case 14: {
          const pan = data;
          const randomPan = pan === 0;
          ch.setMIDIParameter("randomPan", randomPan);
          if (randomPan) SpessaLog.xgInfo(`Random Pan for ${channel}`, "ON");
          else ch.controllerChange(MIDIControllers.pan, pan);
          break;
        }
        case 18:
          ch.controllerChange(MIDIControllers.chorusDepth, data);
          break;
        case 19:
          ch.controllerChange(MIDIControllers.reverbDepth, data);
          break;
        case 21:
          ch.controllerChange(MIDIControllers.vibratoRate, data);
          break;
        case 22:
          ch.controllerChange(MIDIControllers.vibratoDepth, data);
          break;
        case 23:
          ch.controllerChange(MIDIControllers.vibratoDelay, data);
          break;
        case 24:
          ch.controllerChange(MIDIControllers.brightness, data);
          break;
        case 25:
          ch.controllerChange(MIDIControllers.filterResonance, data);
          break;
        case 26:
          ch.controllerChange(MIDIControllers.attackTime, data);
          break;
        case 27:
          ch.controllerChange(MIDIControllers.decayTime, data);
          break;
        case 28:
          ch.controllerChange(MIDIControllers.releaseTime, data);
          break;
        case 35: {
          const centeredValue = data - 64;
          ch.setMIDIParameter("pitchWheelRange", centeredValue);
          SpessaLog.xgInfo(`Pitch Wheel Range for ${channel}`, centeredValue, "semitones");
        }
      }
      return;
    }
    if (a1 >> 4 === 3) {
      if (this.systemParameters.drumLock) return;
      const drumKey = a2;
      switch (a3) {
        default:
          SpessaLog.xgFail("Drum Setup", [a3]);
          return;
        case 0: {
          const pitch = (data - 64) * 100;
          for (const ch of this.midiChannels) {
            if (!ch.drumChannel) continue;
            ch.drumParams[drumKey].pitch = pitch;
          }
          SpessaLog.xgInfo(`Drum Pitch for key ${drumKey}`, pitch, "semitones");
          break;
        }
        case 1: {
          const pitch = data - 64;
          for (const ch of this.midiChannels) {
            if (!ch.drumChannel) continue;
            ch.drumParams[drumKey].pitch += pitch;
            SpessaLog.xgInfo(`Drum Pitch for key ${drumKey}`, ch.drumParams[drumKey].pitch, "semitones");
          }
          break;
        }
        case 2:
          for (const ch of this.midiChannels) {
            if (!ch.drumChannel) continue;
            ch.drumParams[drumKey].gain = data / 120;
          }
          SpessaLog.xgInfo(`Drum Level for key ${drumKey}`, data);
          break;
        case 3:
          for (const ch of this.midiChannels) {
            if (!ch.drumChannel) continue;
            ch.drumParams[drumKey].exclusiveClass = data;
          }
          SpessaLog.xgInfo(`Drum Alternate Group for key ${drumKey}`, data);
          break;
        case 4:
          for (const ch of this.midiChannels) {
            if (!ch.drumChannel) continue;
            ch.drumParams[drumKey].pan = data;
          }
          SpessaLog.xgInfo(`Drum Pan for key ${drumKey}`, data);
          break;
        case 5:
          for (const ch of this.midiChannels) {
            if (!ch.drumChannel) continue;
            ch.drumParams[drumKey].reverbGain = data / 127;
          }
          SpessaLog.xgInfo(`Drum Reverb for key ${drumKey}`, data);
          break;
        case 6:
          for (const ch of this.midiChannels) {
            if (!ch.drumChannel) continue;
            ch.drumParams[drumKey].chorusGain = data / 127;
          }
          SpessaLog.xgInfo(`Drum Chorus for key ${drumKey}`, data);
          break;
        case 9:
          for (const ch of this.midiChannels) {
            if (!ch.drumChannel) continue;
            ch.drumParams[drumKey].rxNoteOff = data === 1;
          }
          SpessaLog.xgInfo(`Drum Note Off for key ${drumKey}`, data === 1 ? "ON" : "OFF");
          break;
        case 10:
          for (const ch of this.midiChannels) {
            if (!ch.drumChannel) continue;
            ch.drumParams[drumKey].rxNoteOn = data === 1;
          }
          SpessaLog.xgInfo(`Drum Note On for key ${drumKey}`, data === 1 ? "ON" : "OFF");
          break;
      }
      return;
    }
    if (a1 === 6 || a1 === 7) {
      this.callEvent("displayMessage", [...syx]);
      return;
    }
    SpessaLog.xgFail("System Exclusive", syx, "Unknown address");
  } else SpessaLog.xgFail("System Exclusive", syx);
}
function systemExclusiveInternal(syx, channelOffset = 0) {
  channelOffset += this.portSelectChannelOffset;
  const manufacturer = syx[0];
  if (this.systemParameters.deviceID !== -1 && syx[1] !== 127 && this.systemParameters.deviceID !== syx[1]) return;
  switch (manufacturer) {
    default:
      SpessaLog.unsupported("System Exclusive", syx, `Unknown manufacturer: ${manufacturer}`);
      break;
    case 126:
    case 127:
      universalSystemExclusive.call(this, syx, channelOffset);
      break;
    case 65:
      rolandSystemExclusive.call(this, syx, channelOffset);
      break;
    case 67:
      yamahaSystemExclusive.call(this, syx, channelOffset);
      break;
    case 245:
      if (syx.length < 2) return;
      this.portSelectChannelOffset = (syx[1] - 1) * 16;
      while (this.midiChannels.length <= this.portSelectChannelOffset) {
        SpessaLog.info(`%cPort select, channel offset %c${this.portSelectChannelOffset}%c. Creating a new port!`, ConsoleColors.info, ConsoleColors.value, ConsoleColors.info);
        for (let i = 0; i < 16; i++) this.createMIDIChannel(true);
      }
      break;
  }
}
var ThruFX = class {
  sendLevelToReverb = 40 / 127;
  sendLevelToChorus = 0;
  sendLevelToDelay = 0;
  type = 0;
  reset() {
  }
  process(inputLeft, inputRight, outputLeft, outputRight, outputReverb, outputChorus, outputDelay, startIndex, sampleCount) {
    const { sendLevelToReverb, sendLevelToChorus, sendLevelToDelay } = this;
    for (let i = 0; i < sampleCount; i++) {
      const sL = inputLeft[i];
      const sR = inputRight[i];
      const idx = startIndex + i;
      outputLeft[idx] += sL;
      outputRight[idx] += sR;
      const mono = (sL + sR) * 0.5;
      outputReverb[i] += mono * sendLevelToReverb;
      outputChorus[i] += mono * sendLevelToChorus;
      outputDelay[i] += mono * sendLevelToDelay;
    }
  }
  setParameter(parameter, value) {
  }
};
var InsertionValueConverter = class {
  static data = [
    [
      0,
      200,
      200,
      0,
      0,
      0.05,
      0.05,
      315,
      250,
      200,
      250,
      100,
      -180,
      0
    ],
    [
      0.1,
      205,
      205,
      0.1,
      5,
      0.1,
      0.1,
      315,
      250,
      200,
      250,
      110,
      -180,
      1
    ],
    [
      0.2,
      210,
      210,
      0.2,
      10,
      0.15,
      0.15,
      315,
      250,
      200,
      250,
      120,
      -180,
      2
    ],
    [
      0.3,
      215,
      215,
      0.3,
      15,
      0.2,
      0.2,
      315,
      250,
      200,
      250,
      130,
      -180,
      3
    ],
    [
      0.4,
      220,
      220,
      0.4,
      20,
      0.25,
      0.25,
      315,
      250,
      200,
      250,
      140,
      -180,
      4
    ],
    [
      0.5,
      225,
      225,
      0.5,
      25,
      0.3,
      0.3,
      315,
      250,
      200,
      250,
      150,
      -180,
      5
    ],
    [
      0.6,
      230,
      230,
      0.6,
      30,
      0.35,
      0.35,
      315,
      250,
      200,
      250,
      160,
      -168,
      5
    ],
    [
      0.7,
      235,
      235,
      0.7,
      35,
      0.4,
      0.4,
      315,
      250,
      200,
      250,
      170,
      -168,
      5
    ],
    [
      0.8,
      240,
      240,
      0.8,
      40,
      0.45,
      0.45,
      400,
      315,
      250,
      315,
      180,
      -168,
      5
    ],
    [
      0.9,
      245,
      245,
      0.9,
      45,
      0.5,
      0.5,
      400,
      315,
      250,
      315,
      190,
      -168,
      5
    ],
    [
      1,
      250,
      250,
      1,
      50,
      0.55,
      0.55,
      400,
      315,
      250,
      315,
      200,
      -156,
      5
    ],
    [
      1.1,
      255,
      255,
      1.1,
      55,
      0.6,
      0.6,
      400,
      315,
      250,
      315,
      210,
      -156,
      5
    ],
    [
      1.2,
      260,
      260,
      1.2,
      60,
      0.65,
      0.65,
      400,
      315,
      250,
      315,
      220,
      -156,
      5
    ],
    [
      1.3,
      265,
      265,
      1.3,
      65,
      0.7,
      0.7,
      400,
      315,
      250,
      315,
      230,
      -156,
      5
    ],
    [
      1.4,
      270,
      270,
      1.4,
      70,
      0.75,
      0.75,
      400,
      315,
      250,
      315,
      240,
      -144,
      5
    ],
    [
      1.5,
      275,
      275,
      1.5,
      75,
      0.8,
      0.8,
      400,
      315,
      250,
      315,
      250,
      -144,
      5
    ],
    [
      1.6,
      280,
      280,
      1.6,
      80,
      0.85,
      0.85,
      500,
      400,
      315,
      400,
      260,
      -144,
      5
    ],
    [
      1.7,
      285,
      285,
      1.7,
      85,
      0.9,
      0.9,
      500,
      400,
      315,
      400,
      270,
      -144,
      5
    ],
    [
      1.8,
      290,
      290,
      1.8,
      90,
      0.95,
      0.95,
      500,
      400,
      315,
      400,
      280,
      -132,
      5
    ],
    [
      1.9,
      295,
      295,
      1.9,
      95,
      1,
      1,
      500,
      400,
      315,
      400,
      290,
      -132,
      5
    ],
    [
      2,
      300,
      300,
      2,
      100,
      1.05,
      1.05,
      500,
      400,
      315,
      400,
      300,
      -132,
      5
    ],
    [
      2.1,
      305,
      305,
      2.1,
      105,
      1.1,
      1.1,
      500,
      400,
      315,
      400,
      320,
      -132,
      5
    ],
    [
      2.2,
      310,
      310,
      2.2,
      110,
      1.15,
      1.15,
      500,
      400,
      315,
      400,
      340,
      -120,
      5
    ],
    [
      2.3,
      315,
      315,
      2.3,
      115,
      1.2,
      1.2,
      500,
      400,
      315,
      400,
      360,
      -120,
      5
    ],
    [
      2.4,
      320,
      320,
      2.4,
      120,
      1.25,
      1.25,
      630,
      500,
      400,
      500,
      380,
      -120,
      5
    ],
    [
      2.5,
      325,
      325,
      2.5,
      125,
      1.3,
      1.3,
      630,
      500,
      400,
      500,
      400,
      -120,
      5
    ],
    [
      2.6,
      330,
      330,
      2.6,
      130,
      1.35,
      1.35,
      630,
      500,
      400,
      500,
      420,
      -108,
      5
    ],
    [
      2.7,
      335,
      335,
      2.7,
      135,
      1.4,
      1.4,
      630,
      500,
      400,
      500,
      440,
      -108,
      5
    ],
    [
      2.8,
      340,
      340,
      2.8,
      140,
      1.45,
      1.45,
      630,
      500,
      400,
      500,
      460,
      -108,
      5
    ],
    [
      2.9,
      345,
      345,
      2.9,
      145,
      1.5,
      1.5,
      630,
      500,
      400,
      500,
      480,
      -108,
      5
    ],
    [
      3,
      350,
      350,
      3,
      150,
      1.55,
      1.55,
      630,
      500,
      400,
      500,
      500,
      -96,
      6
    ],
    [
      3.1,
      355,
      355,
      3.1,
      155,
      1.6,
      1.6,
      630,
      500,
      400,
      500,
      520,
      -96,
      6
    ],
    [
      3.2,
      360,
      360,
      3.2,
      160,
      1.65,
      1.65,
      800,
      630,
      500,
      630,
      540,
      -96,
      6
    ],
    [
      3.3,
      365,
      365,
      3.3,
      165,
      1.7,
      1.7,
      800,
      630,
      500,
      630,
      560,
      -96,
      6
    ],
    [
      3.4,
      370,
      370,
      3.4,
      170,
      1.75,
      1.75,
      800,
      630,
      500,
      630,
      580,
      -84,
      6
    ],
    [
      3.5,
      375,
      375,
      3.5,
      175,
      1.8,
      1.8,
      800,
      630,
      500,
      630,
      600,
      -84,
      6
    ],
    [
      3.6,
      380,
      380,
      3.6,
      180,
      1.85,
      1.85,
      800,
      630,
      500,
      630,
      620,
      -84,
      6
    ],
    [
      3.7,
      385,
      385,
      3.7,
      185,
      1.9,
      1.9,
      800,
      630,
      500,
      630,
      640,
      -84,
      6
    ],
    [
      3.8,
      390,
      390,
      3.8,
      190,
      1.95,
      1.95,
      800,
      630,
      500,
      630,
      660,
      -72,
      6
    ],
    [
      3.9,
      395,
      395,
      3.9,
      195,
      2,
      2,
      800,
      630,
      500,
      630,
      680,
      -72,
      6
    ],
    [
      4,
      400,
      400,
      4,
      200,
      2.05,
      2.05,
      1e3,
      800,
      630,
      800,
      700,
      -72,
      6
    ],
    [
      4.1,
      405,
      405,
      4.1,
      205,
      2.1,
      2.1,
      1e3,
      800,
      630,
      800,
      720,
      -72,
      6
    ],
    [
      4.2,
      410,
      410,
      4.2,
      210,
      2.15,
      2.15,
      1e3,
      800,
      630,
      800,
      740,
      -60,
      6
    ],
    [
      4.3,
      415,
      415,
      4.3,
      215,
      2.2,
      2.2,
      1e3,
      800,
      630,
      800,
      760,
      -60,
      6
    ],
    [
      4.4,
      420,
      420,
      4.4,
      220,
      2.25,
      2.25,
      1e3,
      800,
      630,
      800,
      780,
      -60,
      6
    ],
    [
      4.5,
      425,
      425,
      4.5,
      225,
      2.3,
      2.3,
      1e3,
      800,
      630,
      800,
      800,
      -60,
      6
    ],
    [
      4.6,
      430,
      430,
      4.6,
      230,
      2.35,
      2.35,
      1e3,
      800,
      630,
      800,
      820,
      -48,
      6
    ],
    [
      4.7,
      435,
      435,
      4.7,
      235,
      2.4,
      2.4,
      1e3,
      800,
      630,
      800,
      840,
      -48,
      6
    ],
    [
      4.8,
      440,
      440,
      4.8,
      240,
      2.45,
      2.45,
      1250,
      1e3,
      800,
      1e3,
      860,
      -48,
      9
    ],
    [
      4.9,
      445,
      445,
      4.9,
      245,
      2.5,
      2.5,
      1250,
      1e3,
      800,
      1e3,
      880,
      -48,
      9
    ],
    [
      5,
      450,
      450,
      5,
      250,
      2.55,
      2.55,
      1250,
      1e3,
      800,
      1e3,
      900,
      -36,
      9
    ],
    [
      5.5,
      455,
      455,
      5.5,
      255,
      2.6,
      2.6,
      1250,
      1e3,
      800,
      1e3,
      920,
      -36,
      9
    ],
    [
      6,
      460,
      460,
      6,
      260,
      2.65,
      2.65,
      1250,
      1e3,
      800,
      1e3,
      940,
      -36,
      9
    ],
    [
      6.5,
      465,
      465,
      6.5,
      265,
      2.7,
      2.7,
      1250,
      1e3,
      800,
      1e3,
      960,
      -36,
      9
    ],
    [
      7,
      470,
      470,
      7,
      270,
      2.75,
      2.75,
      1250,
      1e3,
      800,
      1e3,
      980,
      -24,
      9
    ],
    [
      7.5,
      475,
      475,
      7.5,
      275,
      2.8,
      2.8,
      1250,
      1e3,
      800,
      1e3,
      1e3,
      -24,
      9
    ],
    [
      8,
      480,
      480,
      8,
      280,
      2.85,
      2.85,
      1600,
      1250,
      1e3,
      1250,
      1100,
      -24,
      9
    ],
    [
      8.5,
      485,
      485,
      8.5,
      285,
      2.9,
      2.9,
      1600,
      1250,
      1e3,
      1250,
      1200,
      -24,
      9
    ],
    [
      9,
      490,
      490,
      9,
      290,
      2.95,
      2.95,
      1600,
      1250,
      1e3,
      1250,
      1300,
      -12,
      9
    ],
    [
      9.5,
      495,
      495,
      9.5,
      295,
      3,
      3,
      1600,
      1250,
      1e3,
      1250,
      1400,
      -12,
      9
    ],
    [
      10,
      500,
      500,
      10,
      300,
      3.05,
      3.05,
      1600,
      1250,
      1e3,
      1250,
      1500,
      -12,
      9
    ],
    [
      11,
      505,
      505,
      11,
      305,
      3.1,
      3.1,
      1600,
      1250,
      1e3,
      1250,
      1600,
      -12,
      9
    ],
    [
      12,
      510,
      510,
      12,
      310,
      3.15,
      3.15,
      1600,
      1250,
      1e3,
      1250,
      1700,
      0,
      9
    ],
    [
      13,
      515,
      515,
      13,
      315,
      3.2,
      3.2,
      1600,
      1250,
      1e3,
      1250,
      1800,
      0,
      9
    ],
    [
      14,
      520,
      520,
      14,
      320,
      3.25,
      3.25,
      2e3,
      1600,
      1250,
      1600,
      1900,
      0,
      12
    ],
    [
      15,
      525,
      525,
      15,
      325,
      3.3,
      3.3,
      2e3,
      1600,
      1250,
      1600,
      2e3,
      0,
      12
    ],
    [
      16,
      530,
      530,
      16,
      330,
      3.35,
      3.35,
      2e3,
      1600,
      1250,
      1600,
      2100,
      12,
      12
    ],
    [
      17,
      535,
      535,
      17,
      335,
      3.4,
      3.4,
      2e3,
      1600,
      1250,
      1600,
      2200,
      12,
      12
    ],
    [
      18,
      540,
      540,
      18,
      340,
      3.45,
      3.45,
      2e3,
      1600,
      1250,
      1600,
      2300,
      12,
      12
    ],
    [
      19,
      545,
      545,
      19,
      345,
      3.5,
      3.5,
      2e3,
      1600,
      1250,
      1600,
      2400,
      12,
      12
    ],
    [
      20,
      550,
      550,
      20,
      350,
      3.55,
      3.55,
      2e3,
      1600,
      1250,
      1600,
      2500,
      24,
      12
    ],
    [
      21,
      560,
      555,
      21,
      355,
      3.6,
      3.6,
      2e3,
      1600,
      1250,
      1600,
      2600,
      24,
      12
    ],
    [
      22,
      570,
      560,
      22,
      360,
      3.65,
      3.65,
      2500,
      2e3,
      1600,
      2e3,
      2700,
      24,
      12
    ],
    [
      23,
      580,
      565,
      23,
      365,
      3.7,
      3.7,
      2500,
      2e3,
      1600,
      2e3,
      2800,
      24,
      12
    ],
    [
      24,
      590,
      570,
      24,
      370,
      3.75,
      3.75,
      2500,
      2e3,
      1600,
      2e3,
      2900,
      36,
      12
    ],
    [
      25,
      600,
      575,
      25,
      375,
      3.8,
      3.8,
      2500,
      2e3,
      1600,
      2e3,
      3e3,
      36,
      12
    ],
    [
      26,
      610,
      580,
      26,
      380,
      3.85,
      3.85,
      2500,
      2e3,
      1600,
      2e3,
      3100,
      36,
      12
    ],
    [
      27,
      620,
      585,
      27,
      385,
      3.9,
      3.9,
      2500,
      2e3,
      1600,
      2e3,
      3200,
      36,
      12
    ],
    [
      28,
      630,
      590,
      28,
      390,
      3.95,
      3.95,
      2500,
      2e3,
      1600,
      2e3,
      3300,
      48,
      12
    ],
    [
      29,
      640,
      595,
      29,
      395,
      4,
      4,
      2500,
      2e3,
      1600,
      2e3,
      3400,
      48,
      12
    ],
    [
      30,
      650,
      600,
      30,
      400,
      4.05,
      4.05,
      3150,
      2500,
      2e3,
      2500,
      3500,
      48,
      10
    ],
    [
      31,
      660,
      610,
      31,
      405,
      4.1,
      4.1,
      3150,
      2500,
      2e3,
      2500,
      3600,
      48,
      10
    ],
    [
      32,
      670,
      620,
      32,
      410,
      4.15,
      4.15,
      3150,
      2500,
      2e3,
      2500,
      3700,
      60,
      10
    ],
    [
      33,
      680,
      630,
      33,
      415,
      4.2,
      4.2,
      3150,
      2500,
      2e3,
      2500,
      3800,
      60,
      10
    ],
    [
      34,
      690,
      640,
      34,
      420,
      4.25,
      4.25,
      3150,
      2500,
      2e3,
      2500,
      3900,
      60,
      10
    ],
    [
      35,
      700,
      650,
      35,
      425,
      4.3,
      4.3,
      3150,
      2500,
      2e3,
      2500,
      4e3,
      60,
      10
    ],
    [
      36,
      710,
      660,
      36,
      430,
      4.35,
      4.35,
      3150,
      2500,
      2e3,
      2500,
      4100,
      72,
      10
    ],
    [
      37,
      720,
      670,
      37,
      435,
      4.4,
      4.4,
      3150,
      2500,
      2e3,
      2500,
      4200,
      72,
      10
    ],
    [
      38,
      730,
      680,
      38,
      440,
      4.45,
      4.45,
      4e3,
      3150,
      2500,
      3150,
      4300,
      72,
      11
    ],
    [
      39,
      740,
      690,
      39,
      445,
      4.5,
      4.5,
      4e3,
      3150,
      2500,
      3150,
      4400,
      72,
      11
    ],
    [
      40,
      750,
      700,
      40,
      450,
      4.55,
      4.55,
      4e3,
      3150,
      2500,
      3150,
      4500,
      84,
      11
    ],
    [
      41,
      760,
      710,
      50,
      455,
      4.6,
      4.6,
      4e3,
      3150,
      2500,
      3150,
      4600,
      84,
      11
    ],
    [
      42,
      770,
      720,
      60,
      460,
      4.65,
      4.65,
      4e3,
      3150,
      2500,
      3150,
      4700,
      84,
      11
    ],
    [
      43,
      780,
      730,
      70,
      465,
      4.7,
      4.7,
      4e3,
      3150,
      2500,
      3150,
      4800,
      84,
      11
    ],
    [
      44,
      790,
      740,
      80,
      470,
      4.75,
      4.75,
      4e3,
      3150,
      2500,
      3150,
      4900,
      96,
      11
    ],
    [
      45,
      800,
      750,
      90,
      475,
      4.8,
      4.8,
      4e3,
      3150,
      2500,
      3150,
      5e3,
      96,
      11
    ],
    [
      46,
      810,
      760,
      100,
      480,
      4.85,
      4.85,
      5e3,
      4e3,
      3150,
      4e3,
      5100,
      96,
      12
    ],
    [
      47,
      820,
      770,
      110,
      485,
      4.9,
      4.9,
      5e3,
      4e3,
      3150,
      4e3,
      5200,
      96,
      12
    ],
    [
      48,
      830,
      780,
      120,
      490,
      4.95,
      4.95,
      5e3,
      4e3,
      3150,
      4e3,
      5300,
      108,
      12
    ],
    [
      49,
      840,
      790,
      130,
      495,
      5,
      5,
      5e3,
      4e3,
      3150,
      4e3,
      5400,
      108,
      12
    ],
    [
      50,
      850,
      800,
      140,
      500,
      5.1,
      5.05,
      5e3,
      4e3,
      3150,
      4e3,
      5500,
      108,
      12
    ],
    [
      52,
      860,
      810,
      150,
      505,
      5.2,
      5.1,
      5e3,
      4e3,
      3150,
      4e3,
      5600,
      108,
      12
    ],
    [
      54,
      870,
      820,
      160,
      510,
      5.3,
      5.15,
      5e3,
      4e3,
      3150,
      4e3,
      5700,
      120,
      12
    ],
    [
      56,
      880,
      830,
      170,
      515,
      5.4,
      5.2,
      5e3,
      4e3,
      3150,
      4e3,
      5800,
      120,
      12
    ],
    [
      58,
      890,
      840,
      180,
      520,
      5.5,
      5.25,
      6300,
      5e3,
      4e3,
      5e3,
      5900,
      120,
      13
    ],
    [
      60,
      900,
      850,
      190,
      525,
      5.6,
      5.3,
      6300,
      5e3,
      4e3,
      5e3,
      6e3,
      120,
      13
    ],
    [
      62,
      910,
      860,
      200,
      530,
      5.7,
      5.35,
      6300,
      5e3,
      4e3,
      5e3,
      6100,
      132,
      13
    ],
    [
      64,
      920,
      870,
      210,
      535,
      5.8,
      5.4,
      6300,
      5e3,
      4e3,
      5e3,
      6200,
      132,
      13
    ],
    [
      66,
      930,
      880,
      220,
      540,
      5.9,
      5.45,
      6300,
      5e3,
      4e3,
      5e3,
      6300,
      132,
      13
    ],
    [
      68,
      940,
      890,
      230,
      545,
      6,
      5.5,
      6300,
      5e3,
      4e3,
      5e3,
      6400,
      132,
      13
    ],
    [
      70,
      950,
      900,
      240,
      550,
      6.1,
      5.55,
      6300,
      5e3,
      4e3,
      5e3,
      6500,
      144,
      13
    ],
    [
      72,
      960,
      910,
      250,
      555,
      6.2,
      5.6,
      6300,
      5e3,
      4e3,
      5e3,
      6600,
      144,
      13
    ],
    [
      74,
      970,
      920,
      260,
      560,
      6.3,
      5.65,
      8e3,
      6300,
      5e3,
      6300,
      6700,
      144,
      14
    ],
    [
      76,
      980,
      930,
      270,
      565,
      6.4,
      5.7,
      8e3,
      6300,
      5e3,
      6300,
      6800,
      144,
      14
    ],
    [
      78,
      990,
      940,
      280,
      570,
      6.5,
      5.75,
      8e3,
      6300,
      5e3,
      6300,
      6900,
      156,
      14
    ],
    [
      80,
      1e3,
      950,
      290,
      575,
      6.6,
      5.8,
      8e3,
      6300,
      5e3,
      6300,
      7e3,
      156,
      14
    ],
    [
      82,
      1e3,
      960,
      300,
      580,
      6.7,
      5.85,
      8e3,
      6300,
      5e3,
      6300,
      7100,
      156,
      14
    ],
    [
      84,
      1e3,
      970,
      320,
      585,
      6.8,
      5.9,
      8e3,
      6300,
      5e3,
      6300,
      7200,
      156,
      14
    ],
    [
      86,
      1e3,
      980,
      340,
      590,
      6.9,
      5.95,
      8e3,
      6300,
      5e3,
      6300,
      7300,
      168,
      14
    ],
    [
      88,
      1e3,
      990,
      360,
      595,
      7,
      6,
      8e3,
      6300,
      5e3,
      6300,
      7400,
      168,
      14
    ],
    [
      90,
      1e3,
      1e3,
      380,
      600,
      7.5,
      6.05,
      13500,
      8e3,
      6300,
      13500,
      7500,
      168,
      15
    ],
    [
      92,
      1e3,
      1e3,
      400,
      605,
      8,
      6.1,
      13500,
      8e3,
      6300,
      13500,
      7600,
      168,
      15
    ],
    [
      94,
      1e3,
      1e3,
      420,
      610,
      8.5,
      6.15,
      13500,
      8e3,
      6300,
      13500,
      7700,
      -180,
      15
    ],
    [
      96,
      1e3,
      1e3,
      440,
      615,
      9,
      6.2,
      13500,
      8e3,
      6300,
      13500,
      7800,
      -180,
      15
    ],
    [
      98,
      1e3,
      1e3,
      460,
      620,
      9.5,
      6.25,
      13500,
      8e3,
      6300,
      13500,
      7900,
      -180,
      15
    ],
    [
      100,
      1e3,
      1e3,
      480,
      625,
      10,
      6.3,
      13500,
      8e3,
      6300,
      13500,
      8e3,
      -180,
      15
    ],
    [
      100,
      1e3,
      1e3,
      500,
      630,
      10,
      6.35,
      13500,
      8e3,
      6300,
      13500,
      8e3,
      -180,
      15
    ],
    [
      100,
      1e3,
      1e3,
      500,
      635,
      10,
      6.4,
      13500,
      8e3,
      6300,
      13500,
      8e3,
      -180,
      15
    ]
  ];
  static preDelayTime(value) {
    return this.data[value][0];
  }
  static delayTime1(value) {
    return this.data[value][1];
  }
  static delayTime2(value) {
    return this.data[value][2];
  }
  static delayTime3(value) {
    return this.data[value][3];
  }
  static delayTime4(value) {
    return this.data[value][4];
  }
  static rate1(value) {
    return this.data[value][5];
  }
  static rate2(value) {
    return this.data[value][6];
  }
  static hfDamp(value) {
    return this.data[value][7];
  }
  static cutoffFreq(value) {
    return this.data[value][8];
  }
  static eqFreq(value) {
    return this.data[value][9];
  }
  static lpf(value) {
    return this.data[value][10];
  }
  static manual(value) {
    return this.data[value][11];
  }
  static azimuth(value) {
    return this.data[value][12];
  }
  static accl(value) {
    return this.data[value][13];
  }
};
var HALF_PI = Math.PI / 2;
var MIN_PAN = -64;
var MAX_PAN = 63;
var PAN_RESOLUTION = MAX_PAN - MIN_PAN;
var PAN_TABLE_LEFT = new Float32Array(PAN_RESOLUTION + 1);
var PAN_TABLE_RIGHT = new Float32Array(PAN_RESOLUTION + 1);
for (let pan = MIN_PAN; pan <= MAX_PAN; pan++) {
  const realPan = (pan - MIN_PAN) / PAN_RESOLUTION;
  const tableIndex = pan - MIN_PAN;
  PAN_TABLE_LEFT[tableIndex] = Math.cos(HALF_PI * realPan);
  PAN_TABLE_RIGHT[tableIndex] = Math.sin(HALF_PI * realPan);
}
function zeroState(h) {
  h.x1 = h.x2 = h.y1 = h.y2 = 0;
}
var ZERO_COEFFS = {
  b0: 1,
  b1: 0,
  b2: 0,
  a0: 1,
  a1: 0,
  a2: 0
};
function applyShelves(x, lowC, highC, lowS, highS) {
  const l = lowC.b0 * x + lowC.b1 * lowS.x1 + lowC.b2 * lowS.x2 - lowC.a1 * lowS.y1 - lowC.a2 * lowS.y2;
  lowS.x2 = lowS.x1;
  lowS.x1 = x;
  lowS.y2 = lowS.y1;
  lowS.y1 = l;
  const h = highC.b0 * l + highC.b1 * highS.x1 + highC.b2 * highS.x2 - highC.a1 * highS.y1 - highC.a2 * highS.y2;
  highS.x2 = highS.x1;
  highS.x1 = l;
  highS.y2 = highS.y1;
  highS.y1 = h;
  return h;
}
function processBiquad(x, coeffs, state) {
  const y = coeffs.b0 * x + coeffs.b1 * state.x1 + coeffs.b2 * state.x2 - coeffs.a1 * state.y1 - coeffs.a2 * state.y2;
  state.x2 = state.x1;
  state.x1 = x;
  state.y2 = state.y1;
  state.y1 = y;
  return y;
}
function computeShelfCoeffs(coeffs, dbGain, f0, fs, isLow) {
  const A = Math.pow(10, dbGain / 40);
  const w0 = 2 * Math.PI * f0 / fs;
  const cosw0 = Math.cos(w0);
  const alpha = Math.sin(w0) / 2 * Math.sqrt((A + 1 / A) * (1 / 1 - 1) + 2);
  let b0, b1, b2, a0, a1, a2;
  if (isLow) {
    b0 = A * (A + 1 - (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha);
    b1 = 2 * A * (A - 1 - (A + 1) * cosw0);
    b2 = A * (A + 1 - (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha);
    a0 = A + 1 + (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha;
    a1 = -2 * (A - 1 + (A + 1) * cosw0);
    a2 = A + 1 + (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha;
  } else {
    b0 = A * (A + 1 + (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha);
    b1 = -2 * A * (A - 1 + (A + 1) * cosw0);
    b2 = A * (A + 1 + (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha);
    a0 = A + 1 - (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha;
    a1 = 2 * (A - 1 - (A + 1) * cosw0);
    a2 = A + 1 - (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha;
  }
  coeffs.b0 = b0 / a0;
  coeffs.b1 = b1 / a0;
  coeffs.b2 = b2 / a0;
  coeffs.a0 = 1;
  coeffs.a1 = a1 / a0;
  coeffs.a2 = a2 / a0;
}
var ZeroStateC = {
  x1: 0,
  x2: 0,
  y1: 0,
  y2: 0
};
var StereoEQFX = class {
  type = 256;
  sendLevelToReverb = 0;
  sendLevelToChorus = 0;
  sendLevelToDelay = 0;
  sampleRate;
  level = 1;
  /**
  * Selects the frequency of the low range (200 Hz/400 Hz).
  * @private
  */
  lowFreq = 400;
  /**
  * Adjusts the gain of the low frequency.
  * [-12;12]
  * @private
  */
  lowGain = 5;
  /**
  * Selects the frequency of the high range (4kHz/8kHz).
  * @private
  */
  hiFreq = 8e3;
  /**
  * Adjusts the gain of the high frequency.
  * [-12;12]
  * @private
  */
  hiGain = -12;
  /**
  * Adjusts the frequency of Mid 1 (mid range1).
  * [200;6300]
  * @private
  */
  m1Freq = 1600;
  /**
  * This parameter adjusts the width of the area around the M1
  * Freq parameter that will be affected by the Gain setting.
  * Higher values of Q will result in a narrower area being
  * affected.
  * 0.5/1.0/2.0/4.0/9.0
  * @private
  */
  m1Q = 0.5;
  /**
  * Adjusts the gain for the area specified by the M1 Freq
  * parameter and M1 Q parameter settings.
  * [-12;12]
  * @private
  */
  m1Gain = 8;
  /**
  * Adjusts the frequency of Mid 2 (mid range2).
  * [200;6300]
  * @private
  */
  m2Freq = 1e3;
  /**
  * This parameter adjusts the width of the area around the M2
  * Freq parameter that will be affected by the Gain setting.
  * Higher values of Q will result in a narrower area being
  * affected.
  * 0.5/1.0/2.0/4.0/9.0
  * @private
  */
  m2Q = 0.5;
  /**
  * Adjusts the gain for the area specified by the M2 Freq
  * parameter and M2 Q parameter settings.
  * [-12;12]
  * @private
  */
  m2Gain = -8;
  lowCoeffs = { ...ZERO_COEFFS };
  m1Coeffs = { ...ZERO_COEFFS };
  m2Coeffs = { ...ZERO_COEFFS };
  hiCoeffs = { ...ZERO_COEFFS };
  lowStateL = { ...ZeroStateC };
  lowStateR = { ...ZeroStateC };
  m1StateL = { ...ZeroStateC };
  m1StateR = { ...ZeroStateC };
  m2StateL = { ...ZeroStateC };
  m2StateR = { ...ZeroStateC };
  hiStateL = { ...ZeroStateC };
  hiStateR = { ...ZeroStateC };
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.reset();
    this.updateCoefficients();
  }
  reset() {
    this.level = 1;
    this.lowFreq = 400;
    this.lowGain = 5;
    this.hiGain = -12;
    this.hiFreq = 8e3;
    this.m1Freq = 1600;
    this.m1Q = 0.5;
    this.m1Gain = 8;
    this.m2Freq = 1e3;
    this.m2Q = 0.5;
    this.m2Gain = -8;
    zeroState(this.lowStateL);
    zeroState(this.lowStateR);
    zeroState(this.m1StateL);
    zeroState(this.m1StateR);
    zeroState(this.m2StateL);
    zeroState(this.m2StateR);
    zeroState(this.hiStateL);
    zeroState(this.hiStateR);
    this.updateCoefficients();
  }
  setParameter(parameter, value) {
    switch (parameter) {
      default:
        break;
      case 3:
        this.lowFreq = value === 1 ? 400 : 200;
        break;
      case 4:
        this.lowGain = value - 64;
        break;
      case 5:
        this.hiFreq = value === 1 ? 8e3 : 4e3;
        break;
      case 6:
        this.hiGain = value - 64;
        break;
      case 7:
        this.m1Freq = InsertionValueConverter.eqFreq(value);
        break;
      case 8:
        this.m1Q = [
          0.5,
          1,
          2,
          4,
          9
        ][value] || 1;
        break;
      case 9:
        this.m1Gain = value - 64;
        break;
      case 10:
        this.m2Freq = InsertionValueConverter.eqFreq(value);
        break;
      case 11:
        this.m2Q = [
          0.5,
          1,
          2,
          4,
          9
        ][value] || 1;
        break;
      case 12:
        this.m2Gain = value - 64;
        break;
      case 22:
        this.level = value / 127;
        break;
    }
    this.updateCoefficients();
  }
  process(inputLeft, inputRight, outputLeft, outputRight, outputReverb, outputChorus, outputDelay, startIndex, sampleCount) {
    const { level, sendLevelToChorus, sendLevelToDelay, sendLevelToReverb, lowCoeffs, lowStateL, lowStateR, m1Coeffs, m1StateL, m1StateR, m2StateL, m2StateR, m2Coeffs, hiCoeffs, hiStateL, hiStateR } = this;
    for (let i = 0; i < sampleCount; i++) {
      let sL = inputLeft[i];
      let sR = inputRight[i];
      sL = processBiquad(sL, lowCoeffs, lowStateL);
      sR = processBiquad(sR, lowCoeffs, lowStateR);
      sL = processBiquad(sL, m1Coeffs, m1StateL);
      sR = processBiquad(sR, m1Coeffs, m1StateR);
      sL = processBiquad(sL, m2Coeffs, m2StateL);
      sR = processBiquad(sR, m2Coeffs, m2StateR);
      sL = processBiquad(sL, hiCoeffs, hiStateL);
      sR = processBiquad(sR, hiCoeffs, hiStateR);
      const idx = startIndex + i;
      outputLeft[idx] += sL * level;
      outputRight[idx] += sR * level;
      const mono = 0.5 * (sL + sR);
      outputReverb[i] += mono * sendLevelToReverb;
      outputChorus[i] += mono * sendLevelToChorus;
      outputDelay[i] += mono * sendLevelToDelay;
    }
  }
  updateCoefficients() {
    computeLowShelfCoeffs(this.lowCoeffs, this.lowFreq, this.lowGain / 2, this.sampleRate);
    computePeakingEQCoeffs(this.m1Coeffs, this.m1Freq, this.m1Gain, this.m1Q, this.sampleRate);
    computePeakingEQCoeffs(this.m2Coeffs, this.m2Freq, this.m2Gain, this.m2Q, this.sampleRate);
    computeHighShelfCoeffs(this.hiCoeffs, this.hiFreq, this.hiGain / 2, this.sampleRate);
  }
};
var SHELF_SLOPE = 1;
function computePeakingEQCoeffs(coeffs, freq, gainDB, Q, sampleRate) {
  const A = Math.pow(10, gainDB / 40);
  const w0 = 2 * Math.PI * freq / sampleRate;
  const cosw0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q);
  const b0 = 1 + alpha * A;
  const b1 = -2 * cosw0;
  const b2 = 1 - alpha * A;
  const a0 = 1 + alpha / A;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha / A;
  coeffs.a0 = 1;
  coeffs.a1 = a1 / a0;
  coeffs.a2 = a2 / a0;
  coeffs.b0 = b0 / a0;
  coeffs.b1 = b1 / a0;
  coeffs.b2 = b2 / a0;
}
function computeLowShelfCoeffs(coeffs, freq, gainDB, sampleRate) {
  const A = Math.pow(10, gainDB / 40);
  const w0 = 2 * Math.PI * freq / sampleRate;
  const cosw0 = Math.cos(w0);
  const alpha = Math.sin(w0) / 2 * Math.sqrt((A + 1 / A) * (1 / SHELF_SLOPE - 1) + 2);
  const b0 = A * (A + 1 - (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha);
  const b1 = 2 * A * (A - 1 - (A + 1) * cosw0);
  const b2 = A * (A + 1 - (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha);
  const a0 = A + 1 + (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha;
  const a1 = -2 * (A - 1 + (A + 1) * cosw0);
  const a2 = A + 1 + (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha;
  coeffs.a0 = 1;
  coeffs.a1 = a1 / a0;
  coeffs.a2 = a2 / a0;
  coeffs.b0 = b0 / a0;
  coeffs.b1 = b1 / a0;
  coeffs.b2 = b2 / a0;
}
function computeHighShelfCoeffs(coeffs, freq, gainDB, sampleRate) {
  const A = Math.pow(10, gainDB / 40);
  const w0 = 2 * Math.PI * freq / sampleRate;
  const cosw0 = Math.cos(w0);
  const alpha = Math.sin(w0) / 2 * Math.sqrt((A + 1 / A) * (1 / SHELF_SLOPE - 1) + 2);
  const b0 = A * (A + 1 + (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha);
  const b1 = -2 * A * (A - 1 + (A + 1) * cosw0);
  const b2 = A * (A + 1 + (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha);
  const a0 = A + 1 - (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha;
  const a1 = 2 * (A - 1 - (A + 1) * cosw0);
  const a2 = A + 1 - (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha;
  coeffs.a0 = 1;
  coeffs.a1 = a1 / a0;
  coeffs.a2 = a2 / a0;
  coeffs.b0 = b0 / a0;
  coeffs.b1 = b1 / a0;
  coeffs.b2 = b2 / a0;
}
var ALL_PASS_STAGES = 8;
var DEPTH_DIV = 128;
var MANUAL_MULTIPLIER = 4;
var MANUAL_OFFSET = 600;
var FEEDBACK = 0.9;
var PHASE_START = 0.35;
var PhaserFX = class {
  sendLevelToReverb = 40 / 127;
  sendLevelToChorus = 0;
  sendLevelToDelay = 0;
  type = 288;
  /**
  * Adjusts the basic frequency from which the sound will be
  * modulated.
  * [100;8000]
  * @private
  */
  manual = 620;
  /**
  * Adjusts the frequency (period) of modulation.
  * @private
  * [0.05;10.0]
  */
  rate = 0.85;
  /**
  * Adjusts the depth of modulation.
  * [0;1]
  * @private
  */
  depth = 64 / DEPTH_DIV;
  /**
  * Adjusts the amount of emphasis added to the frequency
  * range surrounding the basic frequency determined by the
  * Manual parameter setting.
  * [0;1]
  * @private
  */
  reso = 16 / 127;
  /**
  * Adjusts the proportion by which the phase-shifted sound is
  * combined with the direct sound.
  * [0;1]
  * @private
  */
  mix = 1;
  /**
  * Adjusts the gain of the low frequency range. (200Hz)
  * [-12;12]
  * @private
  */
  lowGain = 0;
  /**
  * Adjusts the gain of the high frequency range. (4kHz)
  * [-12;12]
  * @private
  */
  hiGain = 0;
  prevInL;
  prevOutL;
  prevInR;
  prevOutR;
  lowShelfCoef = { ...ZERO_COEFFS };
  highShelfCoef = { ...ZERO_COEFFS };
  manualOffset = MANUAL_OFFSET;
  lowShelfStateL = {
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0
  };
  lowShelfStateR = {
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0
  };
  highShelfStateL = {
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0
  };
  highShelfStateR = {
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0
  };
  prevL = 0;
  prevR = 0;
  /**
  * Adjusts the output level.
  * [0;1]
  * @private
  */
  level = 104 / 127;
  phase = PHASE_START;
  sampleRate;
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.prevInL = new Float32Array(ALL_PASS_STAGES);
    this.prevOutL = new Float32Array(ALL_PASS_STAGES);
    this.prevInR = new Float32Array(ALL_PASS_STAGES);
    this.prevOutR = new Float32Array(ALL_PASS_STAGES);
    this.reset();
  }
  reset() {
    this.phase = PHASE_START;
    this.setManual(620);
    this.rate = 0.85;
    this.depth = 64 / DEPTH_DIV;
    this.reso = 16 / 127;
    this.mix = 1;
    this.lowGain = 0;
    this.hiGain = 0;
    this.level = 104 / 127;
    zeroState(this.highShelfStateL);
    zeroState(this.highShelfStateR);
    zeroState(this.lowShelfStateL);
    zeroState(this.lowShelfStateR);
    this.updateShelves();
    this.clearAllPass();
  }
  process(inputLeft, inputRight, outputLeft, outputRight, outputReverb, outputChorus, outputDelay, startIndex, sampleCount) {
    const { sendLevelToReverb, sendLevelToChorus, sendLevelToDelay, level, manual, manualOffset, mix, lowShelfCoef, lowShelfStateR, lowShelfStateL, highShelfCoef, highShelfStateL, highShelfStateR, prevInL, prevInR, prevOutL, prevOutR, sampleRate, depth } = this;
    let { prevL, prevR, phase } = this;
    const rateInc = this.rate / this.sampleRate;
    const fb = this.reso * FEEDBACK;
    for (let i = 0; i < sampleCount; i++) {
      const sL = applyShelves(inputLeft[i], lowShelfCoef, highShelfCoef, lowShelfStateL, highShelfStateL);
      const sR = applyShelves(inputRight[i], lowShelfCoef, highShelfCoef, lowShelfStateR, highShelfStateR);
      const lfo = 2 * Math.abs(phase - 0.5);
      if ((phase += rateInc) >= 1) phase -= 1;
      const fc = manualOffset + manual * (1 - depth * lfo);
      const tanTerm = Math.tan(Math.PI * fc / sampleRate);
      const a = Math.max(-0.9999, Math.min(0.9999, (1 - tanTerm) / (1 + tanTerm)));
      let apL = sL + fb * prevL;
      let apR = sR + fb * prevR;
      for (let stage = 0; stage < ALL_PASS_STAGES; stage++) {
        const outL2 = -a * apL + prevInL[stage] + a * prevOutL[stage];
        prevInL[stage] = apL;
        prevOutL[stage] = outL2;
        apL = outL2;
        const outR2 = -a * apR + prevInR[stage] + a * prevOutR[stage];
        prevInR[stage] = apR;
        prevOutR[stage] = outR2;
        apR = outR2;
      }
      prevL = apL;
      prevR = apR;
      const outL = (sL + apL * mix) * level;
      const outR = (sR + apR * mix) * level;
      const idx = startIndex + i;
      outputLeft[idx] += outL;
      outputRight[idx] += outR;
      const mono = (outL + outR) * 0.5;
      outputReverb[i] += mono * sendLevelToReverb;
      outputChorus[i] += mono * sendLevelToChorus;
      outputDelay[i] += mono * sendLevelToDelay;
    }
    this.phase = phase;
    this.prevL = prevL;
    this.prevR = prevR;
  }
  setParameter(parameter, value) {
    switch (parameter) {
      default:
        break;
      case 3:
        this.setManual(InsertionValueConverter.manual(value));
        break;
      case 4:
        this.rate = InsertionValueConverter.rate1(value);
        break;
      case 5:
        this.depth = value / DEPTH_DIV;
        break;
      case 6:
        this.reso = value / 127;
        break;
      case 7:
        this.mix = value / 127;
        break;
      case 19:
        this.lowGain = value - 64;
        break;
      case 20:
        this.hiGain = value - 64;
        break;
      case 22:
        this.level = value / 127;
        break;
    }
    this.updateShelves();
  }
  setManual(manualIn) {
    if (manualIn > 1e3) {
      this.manualOffset = MANUAL_OFFSET * 1.5 * MANUAL_MULTIPLIER;
      this.manual = manualIn;
    } else {
      this.manualOffset = MANUAL_OFFSET;
      this.manual = manualIn * MANUAL_MULTIPLIER;
    }
  }
  clearAllPass() {
    this.prevR = 0;
    this.prevL = 0;
    for (let i = 0; i < ALL_PASS_STAGES; i++) {
      this.prevInL[i] = 0;
      this.prevOutL[i] = 0;
      this.prevInR[i] = 0;
      this.prevOutR[i] = 0;
    }
  }
  updateShelves() {
    computeShelfCoeffs(this.lowShelfCoef, this.lowGain, 200, this.sampleRate, true);
    computeShelfCoeffs(this.highShelfCoef, this.hiGain, 4e3, this.sampleRate, false);
  }
};
var PI_2$1 = Math.PI * 2;
var GAIN_LVL = 0.935;
var LEVEL_EXP = 2;
var PAN_SMOOTHING = 0.01;
var DEFAULT_LEVEL$3 = 127;
var AutoPanFX = class {
  sendLevelToReverb = 40 / 127;
  sendLevelToChorus = 0;
  sendLevelToDelay = 0;
  type = 294;
  /**
  * Selects the type of modulation.
  * Tri:
  *  The sound will be modulated like a triangle
  * wave.
  * Sqr:
  *  The sound will be modulated like a square
  * wave.
  * Sin:
  *  The sound will be modulated like a sine
  * wave.
  * Saw1,2: The sound will be modulated like a
  * sawtooth wave. The teeth in Saw1 and
  * Saw2 point at opposite direction.
  *
  * [Tri/Sqr/Sin/Saw1/Saw2 -> 00/01/02/03/04]
  * @private
  */
  modWave = 1;
  /**
  * Adjusts the frequency of modulation.
  * [Rate1 conversion]
  * @private
  */
  modRate = 3.05;
  /**
  * Adjusts the depth of modulation.
  * [0;127]
  * @private
  */
  modDepth = 96;
  /**
  * Adjusts the gain of the low frequency range. (200Hz)
  * [-12;12]
  * @private
  */
  lowGain = 0;
  /**
  * Adjusts the gain of the high frequency range. (4kHz)
  * [-12;12]
  * @private
  */
  hiGain = 0;
  /**
  * Adjusts the output level.
  * [0;1]
  * @private
  */
  level = DEFAULT_LEVEL$3 / 127;
  currentPan = 0;
  phase = 0;
  lsCoeffs = { ...ZERO_COEFFS };
  hsCoeffs = { ...ZERO_COEFFS };
  lsStateR = { ...ZeroStateC };
  lsStateL = { ...ZeroStateC };
  hsStateR = { ...ZeroStateC };
  hsStateL = { ...ZeroStateC };
  sampleRate;
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.reset();
  }
  reset() {
    this.modWave = 1;
    this.modRate = 3.05;
    this.modDepth = 96;
    this.lowGain = 0;
    this.hiGain = 0;
    this.level = DEFAULT_LEVEL$3 / 127;
    this.currentPan = 0;
    this.phase = 0;
    zeroState(this.hsStateR);
    zeroState(this.hsStateL);
    zeroState(this.lsStateR);
    zeroState(this.lsStateL);
    this.updateShelves();
  }
  process(inputLeft, inputRight, outputLeft, outputRight, outputReverb, outputChorus, outputDelay, startIndex, sampleCount) {
    const { sendLevelToReverb, sendLevelToChorus, sendLevelToDelay, level, lsCoeffs, lsStateL, lsStateR, hsCoeffs, hsStateR, hsStateL, modWave } = this;
    const depth = Math.pow(this.modDepth / 127, LEVEL_EXP);
    const scale = 2 / (1 + depth) * GAIN_LVL;
    const rateInc = this.modRate / this.sampleRate;
    let { phase, currentPan } = this;
    for (let i = 0; i < sampleCount; i++) {
      const sL = applyShelves(inputLeft[i], lsCoeffs, hsCoeffs, lsStateL, hsStateL);
      const sR = applyShelves(inputRight[i], lsCoeffs, hsCoeffs, lsStateR, hsStateR);
      let lfo;
      switch (modWave) {
        default:
          lfo = 1 - 4 * Math.abs(phase - 0.5);
          break;
        case 1:
          lfo = phase > 0.5 ? -1 : -Math.cos((phase - 0.75) * PI_2$1);
          break;
        case 2:
          lfo = Math.sin(PI_2$1 * phase);
          break;
        case 3:
          lfo = 1 - 2 * phase;
          break;
        case 4:
          lfo = 2 * phase - 1;
          break;
      }
      if ((phase += rateInc) >= 1) phase -= 1;
      currentPan += (lfo - currentPan) * PAN_SMOOTHING;
      const pan = currentPan * depth;
      const gainL = (1 - pan) * 0.5 * scale;
      const gainR = (1 + pan) * 0.5 * scale;
      const outL = sL * level * gainL;
      const outR = sR * level * gainR;
      const idx = startIndex + i;
      outputLeft[idx] += outL;
      outputRight[idx] += outR;
      const mono = (outL + outR) * 0.5;
      outputReverb[i] += mono * sendLevelToReverb;
      outputChorus[i] += mono * sendLevelToChorus;
      outputDelay[i] += mono * sendLevelToDelay;
    }
    this.currentPan = currentPan;
    this.phase = phase;
  }
  setParameter(parameter, value) {
    switch (parameter) {
      default:
        break;
      case 3:
        this.modWave = value;
        break;
      case 4:
        this.modRate = InsertionValueConverter.rate1(value);
        break;
      case 5:
        this.modDepth = value;
        break;
      case 19:
        this.lowGain = value - 64;
        break;
      case 20:
        this.hiGain = value - 64;
        break;
      case 22:
        this.level = value / 127;
        break;
    }
    this.updateShelves();
  }
  updateShelves() {
    computeShelfCoeffs(this.lsCoeffs, this.lowGain, 200, this.sampleRate, true);
    computeShelfCoeffs(this.hsCoeffs, this.hiGain, 4e3, this.sampleRate, false);
  }
};
var DEFAULT_LEVEL$2 = 96;
var attackTime = 0.1;
var releaseTime = 0.1;
var SENS_COEFF = 27;
var PEAK_DB = 28;
var HPF_Q = -28;
var HPF_FC = 400;
var MANUAL_SCALE = 0.62;
var FC_SMOOTH = 5e-3;
var DEPTH_MUL = 5;
var LFO_SMOOTH_FRAC = DEPTH_MUL * 0.5;
var AutoWahFX = class {
  sendLevelToReverb = 40 / 127;
  sendLevelToChorus = 0;
  sendLevelToDelay = 0;
  type = 289;
  /**
  * Selects the type of filter.
  * LPF: The wah effect will be applied over a wide
  * frequency range.
  * BPF: The wah effect will be applied over a narrow
  * frequency range.
  * 0 - LPF
  * 1 - BPF
  * @private
  */
  filType = 1;
  /**
  * Adjusts the sensitivity with which the filter is controlled. If
  * this value is increased, the filter frequency will change more
  * readily in response to the input level.
  * [0;127]
  * @private
  */
  sens = 0;
  /**
  * Adjusts the center frequency from which the effect is
  * applied.
  *
  * Note: Doesn't use "Manual" conversion??
  * [0;127] (assuming manual though, seems to use a part of the curve)
  * @private
  */
  manual = 68;
  /**
  * Adjusts the amount of the wah effect that will occur in the
  * area of the center frequency. Lower settings will cause the
  * effect to be applied in a broad area around the center
  * frequency. Higher settings will cause the effect to be
  * applied in a more narrow range. In the case of LPF,
  * decreasing the value will cause the wah effect to change
  * less.
  * [0;127]
  * @private
  */
  peak = 62;
  /**
  * Adjusts the speed of the modulation.
  * [Rate1 conversion]
  * @private
  */
  rate = 2.05;
  /**
  * Adjusts the depth of the modulation.
  * [0;127]
  * @private
  */
  depth = 72;
  /**
  * Sets the direction in which the frequency will change when
  * the filter is modulated. With a setting of Up, the filter will
  * change toward a higher frequency. With a setting of Down
  * it will change toward a lower frequency.
  * 0 - down
  * 1 - up
  * @private
  */
  polarity = 1;
  /**
  * Adjusts the stereo location of the output sound. L63 is far
  * left, 0 is center, and R63 is far right.
  * [-64;63]
  * @private
  */
  pan = 0;
  /**
  * Adjusts the gain of the low frequency range. (200Hz)
  * [-12;12]
  * @private
  */
  lowGain = 0;
  /**
  * Adjusts the gain of the high frequency range. (4kHz)
  * [-12;12]
  * @private
  */
  hiGain = 0;
  /**
  * Adjusts the output level.
  * [0;1]
  * @private
  */
  level = DEFAULT_LEVEL$2 / 127;
  coeffs = { ...ZERO_COEFFS };
  state = { ...ZeroStateC };
  hpCoeffs = { ...ZERO_COEFFS };
  hpState = { ...ZeroStateC };
  phase = 0;
  lsCoeffs = { ...ZERO_COEFFS };
  hsCoeffs = { ...ZERO_COEFFS };
  lsState = { ...ZeroStateC };
  hsState = { ...ZeroStateC };
  sampleRate;
  lastFc = this.manual;
  attackCoeff;
  releaseCoeff;
  envelope = 0;
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.attackCoeff = Math.exp(-1 / (attackTime * sampleRate));
    this.releaseCoeff = Math.exp(-1 / (releaseTime * sampleRate));
    this.reset();
  }
  reset() {
    this.filType = 1;
    this.sens = 0;
    this.setManual(68);
    this.peak = 62;
    this.rate = 2.05;
    this.depth = 72;
    this.polarity = 1;
    this.lowGain = 0;
    this.hiGain = 0;
    this.pan = 0;
    this.level = DEFAULT_LEVEL$2 / 127;
    this.phase = 0.2;
    this.lastFc = this.manual;
    zeroState(this.hsState);
    zeroState(this.lsState);
    zeroState(this.state);
    zeroState(this.hpState);
    this.updateShelves();
  }
  process(inputLeft, inputRight, outputLeft, outputRight, outputReverb, outputChorus, outputDelay, startIndex, sampleCount) {
    const { sendLevelToReverb, sendLevelToChorus, sendLevelToDelay, level, lsCoeffs, lsState, hsCoeffs, hsState, coeffs, state, sampleRate, filType, manual, pan, attackCoeff, releaseCoeff, hpState, hpCoeffs } = this;
    let { phase, lastFc, envelope } = this;
    const rateInc = this.rate / this.sampleRate;
    const peak = Math.pow(10, this.peak / 127 * PEAK_DB / 20);
    const hpfPeak = Math.pow(10, this.peak / 127 * HPF_Q / 20);
    const pol = this.polarity === 0 ? -1 : DEPTH_MUL;
    const depth = this.depth / 127 * pol;
    const sens = this.sens / 127;
    const index = pan + 64 | 0;
    const gainL = PAN_TABLE_LEFT[index];
    const gainR = PAN_TABLE_RIGHT[index];
    for (let i = 0; i < sampleCount; i++) {
      const s = applyShelves((inputLeft[i] + inputRight[i]) * 0.5, lsCoeffs, hsCoeffs, lsState, hsState);
      const rectified = Math.abs(s);
      envelope = rectified > envelope ? attackCoeff * envelope + (1 - attackCoeff) * rectified : releaseCoeff * envelope + (1 - releaseCoeff) * rectified;
      const lfo = 2 * Math.abs(phase - 0.5) * depth;
      if ((phase += rateInc) >= 1) phase -= 1;
      const lfoMul = lfo >= LFO_SMOOTH_FRAC || pol < 0 ? 1 : Math.sin(lfo * Math.PI / (2 * LFO_SMOOTH_FRAC));
      const base = manual * (1 + sens * envelope * SENS_COEFF);
      const fc = Math.max(20, base * (1 + lfoMul * lfo));
      lastFc += (Math.max(10, fc) - lastFc) * FC_SMOOTH;
      computeLowpassCoeffs(coeffs, lastFc, peak, sampleRate);
      let processedSample = s;
      if (filType === 1) {
        computeHighpassCoeffs(hpCoeffs, HPF_FC, hpfPeak, sampleRate);
        processedSample = processBiquad(processedSample, hpCoeffs, hpState);
      }
      const mono = processBiquad(processedSample, coeffs, state) * level;
      const outL = mono * gainL;
      const outR = mono * gainR;
      const idx = startIndex + i;
      outputLeft[idx] += outL;
      outputRight[idx] += outR;
      outputReverb[i] += mono * sendLevelToReverb;
      outputChorus[i] += mono * sendLevelToChorus;
      outputDelay[i] += mono * sendLevelToDelay;
    }
    this.phase = phase;
    this.lastFc = lastFc;
    this.envelope = envelope;
  }
  setParameter(parameter, value) {
    switch (parameter) {
      default:
        break;
      case 3:
        this.filType = value;
        break;
      case 4:
        this.sens = value;
        break;
      case 5:
        this.setManual(value);
        break;
      case 6:
        this.peak = value;
        break;
      case 7:
        this.rate = InsertionValueConverter.rate1(value);
        break;
      case 8:
        this.depth = value;
        break;
      case 9:
        this.polarity = value;
        break;
      case 19:
        this.lowGain = value - 64;
        break;
      case 20:
        this.hiGain = value - 64;
        break;
      case 21:
        this.pan = value - 64;
        break;
      case 22:
        this.level = value / 127;
        break;
    }
    this.updateShelves();
  }
  setManual(value) {
    const target = value * MANUAL_SCALE;
    const floor = InsertionValueConverter.manual(Math.floor(target));
    const ceil = InsertionValueConverter.manual(Math.ceil(target));
    const frac = target - Math.floor(target);
    this.manual = floor + (ceil - floor) * frac;
  }
  updateShelves() {
    computeShelfCoeffs(this.lsCoeffs, this.lowGain, 200, this.sampleRate, true);
    computeShelfCoeffs(this.hsCoeffs, this.hiGain, 4e3, this.sampleRate, false);
  }
};
function computeLowpassCoeffs(coeffs, freq, Q, sampleRate) {
  const w0 = 2 * Math.PI * freq / sampleRate;
  const cosw0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q);
  const b1 = 1 - cosw0;
  const b0 = b1 / 2;
  const b2 = b0;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;
  coeffs.a0 = 1;
  coeffs.a1 = a1 / a0;
  coeffs.a2 = a2 / a0;
  coeffs.b0 = b0 / a0;
  coeffs.b1 = b1 / a0;
  coeffs.b2 = b2 / a0;
}
function computeHighpassCoeffs(coeffs, freq, Q, sampleRate) {
  const w0 = 2 * Math.PI * freq / sampleRate;
  const cosw0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q);
  const b0 = (1 + cosw0) / 2;
  const b1 = -(1 + cosw0);
  const b2 = b0;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;
  coeffs.a0 = 1;
  coeffs.a1 = a1 / a0;
  coeffs.a2 = a2 / a0;
  coeffs.b0 = b0 / a0;
  coeffs.b1 = b1 / a0;
  coeffs.b2 = b2 / a0;
}
var DEFAULT_LEVEL$1 = 127;
var PhAutoWahFx = class {
  sendLevelToReverb = 40 / 127;
  sendLevelToChorus = 0;
  sendLevelToDelay = 0;
  type = 4360;
  /**
  * Sets the stereo location of the phaser sound. L63 is far left, 0
  * is center, and R63 is far right.
  * [0;127]
  * @private
  */
  phPan = 0;
  /**
  * Sets the stereo location of the aut-wah sound. L63 is far left, 0
  * is center, and R63 is far right.
  * [0;127]
  * @private
  */
  awPan = 127;
  /**
  * Adjusts the output level.
  * [0;1]
  * @private
  */
  level = DEFAULT_LEVEL$1 / 127;
  phaser;
  autoWah;
  bufferPh;
  bufferAw;
  constructor(sampleRate, maxBufferSize) {
    this.phaser = new PhaserFX(sampleRate);
    this.autoWah = new AutoWahFX(sampleRate);
    this.bufferAw = new Float32Array(maxBufferSize);
    this.bufferPh = new Float32Array(maxBufferSize);
    this.phaser.sendLevelToReverb = 0;
    this.phaser.sendLevelToChorus = 0;
    this.phaser.sendLevelToDelay = 0;
    this.autoWah.sendLevelToReverb = 0;
    this.autoWah.sendLevelToChorus = 0;
    this.autoWah.sendLevelToDelay = 0;
    this.reset();
  }
  reset() {
    this.phPan = 0;
    this.awPan = 127;
    this.level = DEFAULT_LEVEL$1 / 127;
    this.phaser.reset();
    this.autoWah.reset();
    this.phaser.setParameter(22, 127);
    this.autoWah.setParameter(22, 127);
  }
  process(inputLeft, inputRight, outputLeft, outputRight, outputReverb, outputChorus, outputDelay, startIndex, sampleCount) {
    const { sendLevelToReverb, sendLevelToChorus, sendLevelToDelay, level } = this;
    const { bufferPh, bufferAw } = this;
    this.bufferPh.fill(0);
    this.phaser.process(inputLeft, inputLeft, bufferPh, bufferPh, bufferPh, bufferPh, bufferPh, 0, sampleCount);
    this.bufferAw.fill(0);
    this.autoWah.process(inputRight, inputRight, bufferAw, bufferAw, bufferAw, bufferAw, bufferAw, 0, sampleCount);
    const phPan = this.phPan | 0;
    const phL = PAN_TABLE_LEFT[phPan];
    const phR = PAN_TABLE_RIGHT[phPan];
    const awPan = this.awPan | 0;
    const awL = PAN_TABLE_LEFT[awPan];
    const awR = PAN_TABLE_RIGHT[awPan];
    for (let i = 0; i < sampleCount; i++) {
      const outPhaser = bufferPh[i] * 0.5 * level;
      const outAutoWah = bufferAw[i] * 0.5 * level;
      const outL = outPhaser * phL + outAutoWah * awL;
      const outR = outPhaser * phR + outAutoWah * awR;
      const idx = startIndex + i;
      outputLeft[idx] += outL;
      outputRight[idx] += outR;
      const mono = (outL + outR) * 0.5;
      outputReverb[i] += mono * sendLevelToReverb;
      outputChorus[i] += mono * sendLevelToChorus;
      outputDelay[i] += mono * sendLevelToDelay;
    }
  }
  setParameter(parameter, value) {
    if (parameter >= 3 && parameter <= 7) {
      this.phaser.setParameter(parameter, value);
      return;
    }
    if (parameter >= 8 && parameter <= 14) {
      this.autoWah.setParameter(parameter - 5, value);
      return;
    }
    switch (parameter) {
      default:
        break;
      case 18:
        this.phPan = value;
        break;
      case 19:
        this.phaser.setParameter(22, value);
        break;
      case 20:
        this.awPan = value;
        break;
      case 21:
        this.autoWah.setParameter(22, value);
        break;
      case 22:
        this.level = value / 127;
        break;
    }
  }
};
var DEFAULT_LEVEL = 127;
var PI_2 = Math.PI * 2;
var GAIN_SMOOTHING = 0.01;
var TremoloFX = class {
  sendLevelToReverb = 40 / 127;
  sendLevelToChorus = 0;
  sendLevelToDelay = 0;
  type = 293;
  /**
  * Selects the type of modulation.
  * Tri:
  *  The sound will be modulated like a triangle
  * wave.
  * Sqr:
  *  The sound will be modulated like a square
  * wave.
  * Sin:
  *  The sound will be modulated like a sine
  * wave.
  * Saw1,2: The sound will be modulated like a
  * sawtooth wave. The teeth in Saw1 and
  * Saw2 point at opposite direction.
  *
  * [Tri/Sqr/Sin/Saw1/Saw2 -> 00/01/02/03/04]
  * @private
  */
  modWave = 1;
  /**
  * Adjusts the frequency of modulation.
  * [Rate1 conversion]
  * @private
  */
  modRate = 3.05;
  /**
  * Adjusts the depth of modulation.
  * [0;127]
  * @private
  */
  modDepth = 96;
  /**
  * Adjusts the gain of the low frequency range. (200Hz)
  * [-12;12]
  * @private
  */
  lowGain = 0;
  /**
  * Adjusts the gain of the high frequency range. (4kHz)
  * [-12;12]
  * @private
  */
  hiGain = 0;
  /**
  * Adjusts the output level.
  * [0;1]
  * @private
  */
  level = DEFAULT_LEVEL / 127;
  phase = 0;
  currentGain = 1;
  lsCoeffs = { ...ZERO_COEFFS };
  hsCoeffs = { ...ZERO_COEFFS };
  lsStateR = { ...ZeroStateC };
  lsStateL = { ...ZeroStateC };
  hsStateR = { ...ZeroStateC };
  hsStateL = { ...ZeroStateC };
  sampleRate;
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.reset();
  }
  reset() {
    this.modWave = 1;
    this.modRate = 3.05;
    this.modDepth = 96;
    this.lowGain = 0;
    this.hiGain = 0;
    this.level = DEFAULT_LEVEL / 127;
    this.phase = 0;
    this.currentGain = 1;
    zeroState(this.hsStateR);
    zeroState(this.hsStateL);
    zeroState(this.lsStateR);
    zeroState(this.lsStateL);
    this.updateShelves();
  }
  process(inputLeft, inputRight, outputLeft, outputRight, outputReverb, outputChorus, outputDelay, startIndex, sampleCount) {
    const { sendLevelToReverb, sendLevelToChorus, sendLevelToDelay, level, lsCoeffs, lsStateL, lsStateR, hsCoeffs, hsStateR, hsStateL, modDepth, modWave } = this;
    const rateInc = this.modRate / this.sampleRate;
    let { currentGain, phase } = this;
    for (let i = 0; i < sampleCount; i++) {
      const sL = applyShelves(inputLeft[i], lsCoeffs, hsCoeffs, lsStateL, hsStateL);
      const sR = applyShelves(inputRight[i], lsCoeffs, hsCoeffs, lsStateR, hsStateR);
      let lfo;
      switch (modWave) {
        default:
          lfo = 1 - 4 * Math.abs(phase - 0.5);
          break;
        case 1:
          lfo = phase > 0.5 ? -1 : -Math.cos((phase - 0.75) * PI_2);
          break;
        case 2:
          lfo = Math.sin(PI_2 * phase);
          break;
        case 3:
          lfo = 1 - 2 * phase;
          break;
        case 4:
          lfo = 2 * phase - 1;
          break;
      }
      if ((phase += rateInc) >= 1) phase -= 1;
      const tremoloLevel = 1 - (lfo / 2 + 0.5) * (modDepth / 127);
      currentGain += (tremoloLevel - currentGain) * GAIN_SMOOTHING;
      const outL = sL * level * currentGain;
      const outR = sR * level * currentGain;
      const idx = startIndex + i;
      outputLeft[idx] += outL;
      outputRight[idx] += outR;
      const mono = (outL + outR) * 0.5;
      outputReverb[i] += mono * sendLevelToReverb;
      outputChorus[i] += mono * sendLevelToChorus;
      outputDelay[i] += mono * sendLevelToDelay;
    }
    this.phase = phase;
    this.currentGain = currentGain;
  }
  setParameter(parameter, value) {
    switch (parameter) {
      default:
        break;
      case 3:
        this.modWave = value;
        break;
      case 4:
        this.modRate = InsertionValueConverter.rate1(value);
        break;
      case 5:
        this.modDepth = value;
        break;
      case 19:
        this.lowGain = value - 64;
        break;
      case 20:
        this.hiGain = value - 64;
        break;
      case 22:
        this.level = value / 127;
        break;
    }
    this.updateShelves();
  }
  updateShelves() {
    computeShelfCoeffs(this.lsCoeffs, this.lowGain, 200, this.sampleRate, true);
    computeShelfCoeffs(this.hsCoeffs, this.hiGain, 4e3, this.sampleRate, false);
  }
};
var INSERTION_EFFECT_LIST = [
  ThruFX,
  StereoEQFX,
  PhaserFX,
  AutoPanFX,
  AutoWahFX,
  PhAutoWahFx,
  TremoloFX
];
var DattorroReverb = class {
  preDelay = 0;
  preLPF = 0.5;
  inputDiffusion1 = 0.75;
  inputDiffusion2 = 0.625;
  decay = 0.5;
  decayDiffusion1 = 0.7;
  decayDiffusion2 = 0.5;
  damping = 5e-3;
  excursionRate = 0.1;
  excursionDepth = 0.2;
  gain = 1;
  sampleRate;
  lp1 = 0;
  lp2 = 0;
  lp3 = 0;
  excPhase = 0;
  pDWrite = 0;
  taps;
  pDelay;
  pDLength;
  delays = new Array();
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.pDLength = sampleRate;
    this.pDelay = new Float32Array(this.pDLength);
    for (const delay of [
      4771345e-9,
      3595309e-9,
      0.012734787,
      9307483e-9,
      0.022579886,
      0.149625349,
      0.060481839,
      0.1249958,
      0.030509727,
      0.141695508,
      0.089244313,
      0.106280031
    ]) this.makeDelayLine(delay);
    this.taps = Int16Array.from([
      8937872e-9,
      0.099929438,
      0.064278754,
      0.067067639,
      0.066866033,
      6283391e-9,
      0.035818689,
      0.011861161,
      0.121870905,
      0.041262054,
      0.08981553,
      0.070931756,
      0.011256342,
      4065724e-9
    ], (x) => Math.round(x * this.sampleRate));
  }
  process(input, outputLeft, outputRight, startIndex, sampleCount) {
    const pd = this.preDelay | 0;
    const fi = this.inputDiffusion1;
    const si = this.inputDiffusion2;
    const dc = this.decay;
    const ft = this.decayDiffusion1;
    const st = this.decayDiffusion2;
    const dp = 1 - this.damping;
    const ex = this.excursionRate / this.sampleRate;
    const ed = this.excursionDepth * this.sampleRate / 1e3;
    const blockStart = this.pDWrite;
    for (let j = 0; j < sampleCount; j++) this.pDelay[(blockStart + j) % this.pDLength] = input[j];
    for (let i = 0; i < sampleCount; i++) {
      this.lp1 += this.preLPF * (this.pDelay[(this.pDLength + this.pDWrite - pd + i) % this.pDLength] - this.lp1);
      let pre = this.writeDelay(0, this.lp1 - fi * this.readDelay(0));
      pre = this.writeDelay(1, fi * (pre - this.readDelay(1)) + this.readDelay(0));
      pre = this.writeDelay(2, fi * pre + this.readDelay(1) - si * this.readDelay(2));
      pre = this.writeDelay(3, si * (pre - this.readDelay(3)) + this.readDelay(2));
      const split = si * pre + this.readDelay(3);
      const exc = ed * (1 + Math.cos(this.excPhase * 6.28));
      const exc2 = ed * (1 + Math.sin(this.excPhase * 6.2847));
      let temp = this.writeDelay(4, split + dc * this.readDelay(11) + ft * this.readDelayCAt(4, exc));
      this.writeDelay(5, this.readDelayCAt(4, exc) - ft * temp);
      this.lp2 += dp * (this.readDelay(5) - this.lp2);
      temp = this.writeDelay(6, dc * this.lp2 - st * this.readDelay(6));
      this.writeDelay(7, this.readDelay(6) + st * temp);
      temp = this.writeDelay(8, split + dc * this.readDelay(7) + ft * this.readDelayCAt(8, exc2));
      this.writeDelay(9, this.readDelayCAt(8, exc2) - ft * temp);
      this.lp3 += dp * (this.readDelay(9) - this.lp3);
      temp = this.writeDelay(10, dc * this.lp3 - st * this.readDelay(10));
      this.writeDelay(11, this.readDelay(10) + st * temp);
      const leftSample = this.readDelayAt(9, this.taps[0]) + this.readDelayAt(9, this.taps[1]) - this.readDelayAt(10, this.taps[2]) + this.readDelayAt(11, this.taps[3]) - this.readDelayAt(5, this.taps[4]) - this.readDelayAt(6, this.taps[5]) - this.readDelayAt(7, this.taps[6]);
      const idx = i + startIndex;
      outputLeft[idx] += leftSample * this.gain;
      const rightSample = this.readDelayAt(5, this.taps[7]) + this.readDelayAt(5, this.taps[8]) - this.readDelayAt(6, this.taps[9]) + this.readDelayAt(7, this.taps[10]) - this.readDelayAt(9, this.taps[11]) - this.readDelayAt(10, this.taps[12]) - this.readDelayAt(11, this.taps[13]);
      outputRight[idx] += rightSample * this.gain;
      this.excPhase += ex;
      for (let j = 0, d = this.delays[0]; j < this.delays.length; d = this.delays[++j]) {
        d[1] = d[1] + 1 & d[3];
        d[2] = d[2] + 1 & d[3];
      }
    }
    this.pDWrite = (blockStart + sampleCount) % this.pDLength;
  }
  makeDelayLine(length) {
    const len = Math.round(length * this.sampleRate);
    const nextPow2 = 2 ** Math.ceil(Math.log2(len));
    this.delays.push([
      new Float32Array(nextPow2),
      len - 1,
      0,
      nextPow2 - 1
    ]);
  }
  writeDelay(index, sample) {
    return this.delays[index][0][this.delays[index][1]] = sample;
  }
  readDelay(index) {
    return this.delays[index][0][this.delays[index][2]];
  }
  readDelayAt(index, i) {
    const delay = this.delays[index];
    return delay[0][delay[2] + i & delay[3]];
  }
  readDelayCAt(index, i) {
    const d = this.delays[index], frac = i - ~~i, mask = d[3];
    let int = ~~i + d[2] - 1;
    const x0 = d[0][int++ & mask], x1 = d[0][int++ & mask], x2 = d[0][int++ & mask], x3 = d[0][int & mask];
    const a = (3 * (x1 - x2) - x0 + x3) / 2, b = 2 * x2 + x0 - (5 * x1 + x3) / 2, c = (x2 - x0) / 2;
    return ((a * frac + b) * frac + c) * frac + x1;
  }
};
var DelayLine = class {
  feedback = 0;
  gain = 1;
  buffer;
  bufferLength;
  writeIndex = 0;
  constructor(maxDelay) {
    this.buffer = new Float32Array(maxDelay);
    this.bufferLength = this.buffer.length;
    this._time = maxDelay - 5;
  }
  /**
  * Samples
  */
  _time;
  get time() {
    return this._time;
  }
  set time(value) {
    this._time = Math.min(this.bufferLength, value) | 0;
  }
  clear() {
    this.buffer.fill(0);
  }
  /**
  * OVERWRITES the output
  * @param input
  * @param output
  * @param sampleCount
  */
  process(input, output, sampleCount) {
    let writeIndex = this.writeIndex;
    const delay = this._time;
    const buffer = this.buffer;
    const bufferLength = this.bufferLength;
    const feedback = this.feedback;
    const gain = this.gain;
    for (let i = 0; i < sampleCount; i++) {
      let readIndex = writeIndex - delay;
      if (readIndex < 0) readIndex += bufferLength;
      const delayed = buffer[readIndex];
      output[i] = delayed * gain;
      buffer[writeIndex] = input[i] + delayed * feedback;
      if (++writeIndex >= bufferLength) writeIndex = 0;
    }
    this.writeIndex = writeIndex;
  }
};
var DELAY_GAIN$1 = 1.5;
var SpessaSynthReverb = class {
  /**
  * Dattorro reverb processor.
  * @private
  */
  dattorro;
  /**
  * Left delay line, also used for the mono delay. (character 6)
  * @private
  */
  delayLeft;
  /**
  * Right delay line.
  * @private
  */
  delayRight;
  /**
  * Output of the left (and mono) delay.
  * @private
  */
  delayLeftOutput;
  /**
  * Output of the right delay.
  * @private
  */
  delayRightOutput;
  /**
  * Input into the left delay. Mixed dry input and right output.
  * @private
  */
  delayLeftInput;
  /**
  * Pre LPF buffer for the delay characters.
  * @private
  */
  delayPreLPF;
  /**
  * Sample rate of the processor.
  * @private
  */
  sampleRate;
  /**
  * Cutoff frequency
  * @private
  */
  preLPFfc = 8e3;
  /**
  * Alpha
  * @private
  */
  preLPFa = 0;
  /**
  * Previous value
  * @private
  */
  preLPFz = 0;
  /**
  * Reverb time coefficient for different reverb characters.
  * @private
  */
  characterTimeCoefficient = 1;
  /**
  * Reverb gain coefficient for different reverb characters.
  * @private
  */
  characterGainCoefficient = 1;
  /**
  * Reverb pre-lowpass coefficient for different reverb characters.
  * @private
  */
  characterLPFCoefficient = 0;
  /**
  * Gain for the delay output.
  * @private
  */
  delayGain = 1;
  /**
  * Panning delay feedback gain (from the right to the left delay).
  * @private
  */
  panDelayFeedback = 0;
  constructor(sampleRate, maxBufferSize) {
    this.sampleRate = sampleRate;
    this.delayLeftOutput = new Float32Array(maxBufferSize);
    this.delayRightOutput = new Float32Array(maxBufferSize);
    this.delayLeftInput = new Float32Array(maxBufferSize);
    this.delayPreLPF = new Float32Array(maxBufferSize);
    this.dattorro = new DattorroReverb(sampleRate);
    this.delayLeft = new DelayLine(sampleRate);
    this.delayRight = new DelayLine(sampleRate);
  }
  _delayFeedback = 0;
  get delayFeedback() {
    return this._delayFeedback;
  }
  set delayFeedback(value) {
    this._delayFeedback = value;
    this.updateFeedback();
  }
  _character = 0;
  get character() {
    return this._character;
  }
  set character(value) {
    this._character = value;
    this.dattorro.damping = 5e-3;
    this.characterTimeCoefficient = 1;
    this.characterGainCoefficient = 1;
    this.characterLPFCoefficient = 0;
    this.dattorro.inputDiffusion1 = 0.75;
    this.dattorro.inputDiffusion2 = 0.625;
    this.dattorro.decayDiffusion1 = 0.7;
    this.dattorro.decayDiffusion2 = 0.5;
    this.dattorro.excursionRate = 0.5;
    this.dattorro.excursionDepth = 0.7;
    switch (value) {
      case 0:
        this.dattorro.damping = 0.85;
        this.characterTimeCoefficient = 0.9;
        this.characterGainCoefficient = 0.9;
        this.characterLPFCoefficient = 0.2;
        break;
      case 1:
        this.dattorro.damping = 0.2;
        this.characterGainCoefficient = 0.7;
        this.characterTimeCoefficient = 1;
        this.dattorro.decayDiffusion2 = 0.64;
        this.dattorro.decayDiffusion1 = 0.6;
        this.characterLPFCoefficient = 0.2;
        break;
      case 2:
        this.dattorro.damping = 0.56;
        this.characterGainCoefficient = 0.75;
        this.characterTimeCoefficient = 1;
        this.dattorro.decayDiffusion2 = 0.64;
        this.dattorro.decayDiffusion1 = 0.6;
        this.characterLPFCoefficient = 0.1;
        break;
      case 3:
        this.dattorro.damping = 0.3;
        this.characterGainCoefficient = 1.25;
        this.characterTimeCoefficient = 1.3;
        this.characterLPFCoefficient = 0;
        this.dattorro.decayDiffusion2 = 0.7;
        this.dattorro.decayDiffusion1 = 0.66;
        break;
      case 4:
        this.characterGainCoefficient = 1;
        this.characterTimeCoefficient = 1.2;
        this.characterLPFCoefficient = 0.1;
        this.dattorro.damping = 0.1;
        this.dattorro.decayDiffusion2 = 0.69;
        this.dattorro.decayDiffusion1 = 0.67;
        break;
      case 5:
        this.characterGainCoefficient = 0.75;
        this.dattorro.damping = 0.65;
        this.characterTimeCoefficient = 0.5;
        break;
    }
    this.updateTime();
    this.updateGain();
    this.updateLowpass();
    this.updateFeedback();
    this.delayLeft.clear();
    this.delayRight.clear();
  }
  _time = 0;
  get time() {
    return this._time;
  }
  set time(value) {
    this._time = value;
    this.updateTime();
  }
  _preDelayTime = 0;
  get preDelayTime() {
    return this._preDelayTime;
  }
  set preDelayTime(value) {
    this._preDelayTime = value;
    this.dattorro.preDelay = value / 1e3 * this.sampleRate;
  }
  _level = 0;
  get level() {
    return this._level;
  }
  set level(value) {
    this._level = value;
    this.updateGain();
  }
  _preLowpass = 0;
  get preLowpass() {
    return this._preLowpass;
  }
  set preLowpass(value) {
    this._preLowpass = value;
    this.preLPFfc = 8e3 * 0.63 ** this._preLowpass;
    const decay = Math.exp(-2 * Math.PI * this.preLPFfc / this.sampleRate);
    this.preLPFa = 1 - decay;
    this.updateLowpass();
  }
  /**
  *
  * @param input 0-based
  * @param outputLeft startIndex-based
  * @param outputRight startIndex-based
  * @param startIndex
  * @param sampleCount
  */
  process(input, outputLeft, outputRight, startIndex, sampleCount) {
    switch (this._character) {
      default:
        this.dattorro.process(input, outputLeft, outputRight, startIndex, sampleCount);
        return;
      case 6: {
        let delayIn;
        if (this._preLowpass > 0) {
          const preLPF = this.delayPreLPF;
          let z = this.preLPFz;
          const a = this.preLPFa;
          for (let i = 0; i < sampleCount; i++) {
            const x = input[i];
            z += a * (x - z);
            preLPF[i] = z;
          }
          this.preLPFz = z;
          delayIn = preLPF;
        } else delayIn = input;
        this.delayLeft.process(delayIn, this.delayLeftOutput, sampleCount);
        const g = this.delayGain;
        const delay = this.delayLeftOutput;
        for (let i = 0, o = startIndex; i < sampleCount; i++, o++) {
          const sample = delay[i] * g;
          outputRight[o] += sample;
          outputLeft[o] += sample;
        }
        return;
      }
      case 7: {
        let delayIn;
        if (this._preLowpass > 0) {
          const preLPF = this.delayPreLPF;
          let z = this.preLPFz;
          const a = this.preLPFa;
          for (let i = 0; i < sampleCount; i++) {
            const x = input[i];
            z += a * (x - z);
            preLPF[i] = z;
          }
          this.preLPFz = z;
          delayIn = preLPF;
        } else delayIn = input;
        const fb = this.panDelayFeedback;
        const { delayLeftInput, delayLeftOutput, delayRightOutput } = this;
        for (let i = 0; i < sampleCount; i++) delayLeftInput[i] = delayIn[i] + delayRightOutput[i] * fb;
        this.delayLeft.process(delayLeftInput, delayLeftOutput, sampleCount);
        this.delayRight.process(delayLeftOutput, delayRightOutput, sampleCount);
        const g = this.delayGain;
        for (let i = 0, o = startIndex; i < sampleCount; i++, o++) {
          outputLeft[o] += delayLeftOutput[i] * g;
          outputRight[o] += delayRightOutput[i] * g;
        }
        return;
      }
    }
  }
  getSnapshot() {
    return {
      level: this._level,
      preLowpass: this._preLowpass,
      character: this._character,
      time: this._time,
      delayFeedback: this._delayFeedback,
      preDelayTime: this._preDelayTime
    };
  }
  updateFeedback() {
    const exp = 1 - (1 - this._delayFeedback / 127) ** 1.9;
    if (this._character === 6) this.delayLeft.feedback = exp * 0.73;
    else {
      this.delayLeft.feedback = this.delayRight.feedback = 0;
      this.panDelayFeedback = exp * 0.73;
    }
  }
  updateLowpass() {
    this.dattorro.preLPF = Math.min(1, 0.1 + (7 - this.preLowpass) / 14 + this.characterLPFCoefficient);
  }
  updateGain() {
    this.dattorro.gain = this._level / 345 * this.characterGainCoefficient;
    this.delayGain = this._level / 127 * DELAY_GAIN$1;
  }
  updateTime() {
    const t = this._time / 127;
    this.dattorro.decay = this.characterTimeCoefficient * (0.05 + 0.65 * t);
    const timeSamples = Math.max(21, t * this.sampleRate * 0.4468 | 0);
    if (this.character === 7) this.delayRight.time = this.delayLeft.time = Math.floor(timeSamples / 2);
    else this.delayLeft.time = timeSamples;
  }
};
var CHORUS_GAIN = 1.3;
var SpessaSynthChorus = class {
  /**
  * Cutoff frequency
  * @private
  */
  preLPFfc = 8e3;
  /**
  * Alpha
  * @private
  */
  preLPFa = 0;
  /**
  * Previous value
  * @private
  */
  preLPFz = 0;
  leftDelayBuffer;
  rightDelayBuffer;
  sampleRate;
  phase = 0;
  write = 0;
  gain = 0.5;
  reverbGain = 0;
  delayGain = 0;
  depthSamples = 0;
  delaySamples = 1;
  rateInc = 0;
  feedbackGain = 0;
  constructor(sampleRate, maxBufferSize) {
    this.sampleRate = sampleRate;
    this.leftDelayBuffer = new Float32Array(sampleRate);
    this.rightDelayBuffer = new Float32Array(sampleRate);
    this.preLowpass = 0;
  }
  _sendLevelToReverb = 0;
  get sendLevelToReverb() {
    return this._sendLevelToReverb;
  }
  set sendLevelToReverb(value) {
    this._sendLevelToReverb = value;
    this.reverbGain = value / 127;
  }
  _sendLevelToDelay = 0;
  get sendLevelToDelay() {
    return this._sendLevelToDelay;
  }
  set sendLevelToDelay(value) {
    this._sendLevelToDelay = value;
    this.delayGain = value / 127;
  }
  _preLowpass = 0;
  get preLowpass() {
    return this._preLowpass;
  }
  set preLowpass(value) {
    this._preLowpass = value;
    this.preLPFfc = 8e3 * 0.63 ** this._preLowpass;
    const decay = Math.exp(-2 * Math.PI * this.preLPFfc / this.sampleRate);
    this.preLPFa = 1 - decay;
  }
  _depth = 0;
  get depth() {
    return this._depth;
  }
  set depth(value) {
    this._depth = value;
    this.depthSamples = value / 127 * 0.025 * this.sampleRate;
  }
  _delay = 0;
  get delay() {
    return this._delay;
  }
  set delay(value) {
    this._delay = value;
    this.delaySamples = Math.max(1, value / 127 * 0.025 * this.sampleRate);
  }
  _feedback = 0;
  get feedback() {
    return this._feedback;
  }
  set feedback(value) {
    this._feedback = value;
    this.feedbackGain = value * 763e-5;
  }
  _rate = 0;
  get rate() {
    return this._rate;
  }
  set rate(value) {
    this._rate = value;
    const rate = value * 0.122;
    this.rateInc = rate / this.sampleRate;
  }
  _level = 64;
  get level() {
    return this._level;
  }
  set level(value) {
    this.gain = value / 127 * CHORUS_GAIN;
    this._level = value;
  }
  process(input, outputLeft, outputRight, outputReverb, outputDelay, startIndex, sampleCount) {
    const bufferL = this.leftDelayBuffer;
    const bufferR = this.rightDelayBuffer;
    const rateInc = this.rateInc;
    const bufferLen = bufferL.length;
    const depth = this.depthSamples;
    const delay = this.delaySamples;
    const gain = this.gain;
    const reverbGain = this.reverbGain;
    const delayGain = this.delayGain;
    const feedback = this.feedbackGain;
    const preLPF = this._preLowpass > 0;
    let phase = this.phase;
    let write = this.write;
    let z = this.preLPFz;
    const a = this.preLPFa;
    for (let i = 0; i < sampleCount; i++) {
      let inputSample = input[i];
      if (preLPF) {
        z += a * (inputSample - z);
        inputSample = z;
      }
      const lfo = 2 * Math.abs(phase - 0.5);
      const dL = Math.max(1, Math.min(delay + lfo * depth, bufferLen));
      let readPosL = write - dL;
      if (readPosL < 0) readPosL += bufferLen;
      let x0 = readPosL | 0;
      let x1 = x0 + 1;
      if (x1 >= bufferLen) x1 -= bufferLen;
      let frac = readPosL - x0;
      const outL = bufferL[x0] * (1 - frac) + bufferL[x1] * frac;
      bufferL[write] = inputSample + outL * feedback;
      const dR = Math.max(1, Math.min(delay + (1 - lfo) * depth, bufferLen));
      let readPosR = write - dR;
      if (readPosR < 0) readPosR += bufferLen;
      x0 = readPosR | 0;
      x1 = x0 + 1;
      if (x1 >= bufferLen) x1 -= bufferLen;
      frac = readPosR - x0;
      const outR = bufferR[x0] * (1 - frac) + bufferR[x1] * frac;
      const o = i + startIndex;
      outputLeft[o] += outL * gain;
      outputRight[o] += outR * gain;
      const mono = (outL + outR) / 2;
      outputReverb[i] += mono * reverbGain;
      outputDelay[i] += mono * delayGain;
      bufferR[write] = inputSample + outR * feedback;
      if (++write >= bufferLen) write = 0;
      if ((phase += rateInc) >= 1) phase -= 1;
    }
    this.write = write;
    this.phase = phase;
    this.preLPFz = z;
  }
  getSnapshot() {
    return {
      preLowpass: this._preLowpass,
      depth: this._depth,
      delay: this._delay,
      sendLevelToDelay: this._sendLevelToDelay,
      sendLevelToReverb: this._sendLevelToReverb,
      rate: this._rate,
      feedback: this._feedback,
      level: this._level
    };
  }
};
var delayTimeSegments = [
  {
    start: 1,
    end: 20,
    timeStart: 0.1,
    resolution: 0.1
  },
  {
    start: 20,
    end: 35,
    timeStart: 2,
    resolution: 0.2
  },
  {
    start: 35,
    end: 45,
    timeStart: 5,
    resolution: 0.5
  },
  {
    start: 45,
    end: 55,
    timeStart: 10,
    resolution: 1
  },
  {
    start: 55,
    end: 70,
    timeStart: 20,
    resolution: 2
  },
  {
    start: 70,
    end: 80,
    timeStart: 50,
    resolution: 5
  },
  {
    start: 80,
    end: 90,
    timeStart: 100,
    resolution: 10
  },
  {
    start: 90,
    end: 105,
    timeStart: 200,
    resolution: 20
  },
  {
    start: 105,
    end: 116,
    timeStart: 500,
    resolution: 50
  }
];
var DELAY_GAIN = 1.66;
var SpessaSynthDelay = class {
  /**
  * Cutoff frequency
  * @private
  */
  preLPFfc = 8e3;
  /**
  * Alpha
  * @private
  */
  preLPFa = 0;
  /**
  * Previous value
  * @private
  */
  preLPFz = 0;
  delayLeft;
  delayRight;
  delayCenter;
  sampleRate;
  delayCenterOutput;
  delayPreLPF;
  delayCenterTime;
  delayLeftMultiplier = 0.04;
  delayRightMultiplier = 0.04;
  gain = 0;
  reverbGain = 0;
  constructor(sampleRate, maxBufferSize) {
    this.sampleRate = sampleRate;
    this.delayCenterOutput = new Float32Array(maxBufferSize);
    this.delayPreLPF = new Float32Array(maxBufferSize);
    this.delayCenterTime = 0.34 * sampleRate;
    this.delayCenter = new DelayLine(sampleRate);
    this.delayLeft = new DelayLine(sampleRate);
    this.delayRight = new DelayLine(sampleRate);
  }
  _sendLevelToReverb = 0;
  get sendLevelToReverb() {
    return this._sendLevelToReverb;
  }
  set sendLevelToReverb(value) {
    this._sendLevelToReverb = value;
    this.reverbGain = value / 127;
  }
  _preLowpass = 0;
  get preLowpass() {
    return this._preLowpass;
  }
  set preLowpass(value) {
    this._preLowpass = value;
    this.preLPFfc = 8e3 * 0.63 ** this._preLowpass;
    const decay = Math.exp(-2 * Math.PI * this.preLPFfc / this.sampleRate);
    this.preLPFa = 1 - decay;
  }
  _levelRight = 0;
  get levelRight() {
    return this._levelRight;
  }
  set levelRight(value) {
    this._levelRight = value;
    this.updateGain();
  }
  _level = 64;
  get level() {
    return this._level;
  }
  set level(value) {
    this._level = value;
    this.gain = value / 127 * DELAY_GAIN;
  }
  _levelCenter = 127;
  get levelCenter() {
    return this._levelCenter;
  }
  set levelCenter(value) {
    this._levelCenter = value;
    this.updateGain();
  }
  _levelLeft = 0;
  get levelLeft() {
    return this._levelLeft;
  }
  set levelLeft(value) {
    this._levelLeft = value;
    this.updateGain();
  }
  _feedback = 16;
  get feedback() {
    return this._feedback;
  }
  set feedback(value) {
    this._feedback = value;
    this.delayLeft.feedback = this.delayRight.feedback = 0;
    this.delayCenter.feedback = (value - 64) / 66;
  }
  _timeRatioRight = 0;
  get timeRatioRight() {
    return this._timeRatioRight;
  }
  set timeRatioRight(value) {
    this._timeRatioRight = value;
    this.delayRightMultiplier = value * (100 / 2400);
    this.delayRight.time = this.delayCenterTime * this.delayRightMultiplier;
  }
  _timeRatioLeft = 0;
  get timeRatioLeft() {
    return this._timeRatioLeft;
  }
  set timeRatioLeft(value) {
    this._timeRatioLeft = value;
    this.delayLeftMultiplier = value * (100 / 2400);
    this.delayLeft.time = this.delayCenterTime * this.delayLeftMultiplier;
  }
  _timeCenter = 12;
  get timeCenter() {
    return this._timeCenter;
  }
  set timeCenter(value) {
    this._timeCenter = value;
    let delayMs = 0.1;
    for (const segment of delayTimeSegments) if (value >= segment.start && value < segment.end) {
      delayMs = segment.timeStart + (value - segment.start) * segment.resolution;
      break;
    }
    this.delayCenterTime = Math.max(2, this.sampleRate * (delayMs / 1e3));
    this.delayCenter.time = this.delayCenterTime;
    this.delayLeft.time = this.delayCenterTime * this.delayLeftMultiplier;
    this.delayRight.time = this.delayCenterTime * this.delayRightMultiplier;
  }
  process(input, outputLeft, outputRight, outputReverb, startIndex, sampleCount) {
    let delayIn;
    if (this._preLowpass > 0) {
      const preLPF = this.delayPreLPF;
      let z = this.preLPFz;
      const a = this.preLPFa;
      for (let i = 0; i < sampleCount; i++) {
        const x = input[i];
        z += a * (x - z);
        preLPF[i] = z;
      }
      this.preLPFz = z;
      delayIn = preLPF;
    } else delayIn = input;
    const { gain, reverbGain } = this;
    this.delayCenter.process(delayIn, this.delayCenterOutput, sampleCount);
    const center = this.delayCenterOutput;
    for (let i = 0, o = startIndex; i < sampleCount; i++, o++) {
      const sample = center[i];
      outputReverb[i] += sample * reverbGain;
      const outSample = sample * gain;
      outputLeft[o] += outSample;
      outputRight[o] += outSample;
    }
    for (let i = 0; i < sampleCount; i++) center[i] += input[i];
    const stereoOut = this.delayPreLPF;
    this.delayLeft.process(center, stereoOut, sampleCount);
    for (let i = 0, o = startIndex; i < sampleCount; i++, o++) {
      const sample = stereoOut[i];
      outputLeft[o] += sample * gain;
      outputReverb[i] += sample * reverbGain;
    }
    this.delayRight.process(center, stereoOut, sampleCount);
    for (let i = 0, o = startIndex; i < sampleCount; i++, o++) {
      const sample = stereoOut[i];
      outputRight[o] += sample * gain;
      outputReverb[i] += sample * reverbGain;
    }
  }
  getSnapshot() {
    return {
      level: this._level,
      preLowpass: this._preLowpass,
      timeCenter: this._timeCenter,
      timeRatioRight: this._timeRatioRight,
      timeRatioLeft: this._timeRatioLeft,
      levelCenter: this._levelCenter,
      levelLeft: this._levelLeft,
      levelRight: this._levelRight,
      feedback: this._feedback,
      sendLevelToReverb: this._sendLevelToReverb
    };
  }
  updateGain() {
    this.delayCenter.gain = this._levelCenter / 127;
    this.delayLeft.gain = this._levelLeft / 127;
    this.delayRight.gain = this._levelRight / 127;
  }
};
var DEFAULT_GLOBAL_MIDI_PARAMETERS = {
  volume: 1,
  pan: 0,
  keyShift: 0,
  fineTune: 0,
  system: "gs"
};
function setMIDIParameterInternal(parameter, value) {
  if (this.lockedMIDIParameters[parameter]) return;
  this.midiParameters[parameter] = value;
  for (const ch of this.midiChannels) ch.updateInternalParams();
  this.callEvent("globalParamChange", {
    parameter,
    value
  });
}
function lockMIDIParameterInternal(parameter, isLocked) {
  this.lockedMIDIParameters[parameter] = isLocked;
}
var GAIN_SMOOTHING_FACTOR = 0.01;
var PAN_SMOOTHING_FACTOR = 0.05;
var SynthesizerCore = class {
  /**
  * Voices of this synthesizer, as a fixed voice pool.
  */
  voices = [];
  /**
  * All MIDI channels of the synthesizer.
  */
  midiChannels = [];
  /**
  * The maximum allowed buffer size to render.
  */
  maxBufferSize;
  /**
  * The buffer to use when rendering a voice.
  */
  voiceBuffer;
  /**
  * The insertion processor's left input buffer.
  */
  insertionInputL;
  /**
  * The insertion processor's right input buffer.
  */
  insertionInputR;
  /**
  * The reverb processor's input buffer.
  */
  reverbInput;
  /**
  * The chorus processor's input buffer.
  */
  chorusInput;
  /**
  * The delay processor's input buffer.
  */
  delayInput;
  /**
  * Delay is not used outside SC-88+ MIDIs, this is an optimization.
  */
  delayActive = false;
  /**
  * The sound bank manager, which manages all sound banks and presets.
  */
  soundBankManager = new SoundBankManager(this.updatePresetList.bind(this));
  /**
  * Handles the custom key overrides: velocity and preset
  */
  keyModifierManager = new KeyModifierManager();
  sampleRate;
  /**
  * This.tunings[program * 128 + key] = midiNote,cents (fraction)
  * All MIDI Tuning Standard tunings, 128 keys for each of 128 programs.
  * -1 means no change.
  */
  tunings = new Float32Array(16384).fill(-1);
  /**
  * An object indicating if a Global MIDI parameter, at the equivalent key, is locked
  * (i.e., not allowed changing).
  * A locked parameter cannot be modified.
  * @internal
  */
  lockedMIDIParameters = Object.fromEntries(Object.keys(DEFAULT_GLOBAL_MIDI_PARAMETERS).map((key) => [key, false]));
  /**
  * The global MIDI parameters of the synthesizer.
  */
  midiParameters = { ...DEFAULT_GLOBAL_MIDI_PARAMETERS };
  /**
  * The system parameters of the synthesizer.
  */
  systemParameters = { ...DEFAULT_GLOBAL_SYSTEM_PARAMETERS };
  /**
  * The current time of the synthesizer, in seconds.
  */
  currentTime = 0;
  /**
  * Synth's default (reset) preset.
  */
  defaultPreset;
  /**
  * Synth's default (reset) drum preset.
  */
  drumPreset;
  /**
  * Gain smoothing factor, adjusted to the sample rate.
  */
  gainSmoothingFactor;
  /**
  * Pan smoothing factor, adjusted to the sample rate.
  */
  panSmoothingFactor;
  /**
  * Calls when an event occurs.
  * @param eventType The event type.
  * @param eventData The event data.
  */
  eventCallbackHandler;
  missingPresetHandler;
  /**
  * Cached voices for all presets for this synthesizer.
  * Nesting is calculated in getCachedVoiceIndex, returns a list of voices for this note.
  */
  cachedVoices = /* @__PURE__ */ new Map();
  /**
  * Locks or unlocks a given Global MIDI Parameter.
  * This prevents any changes to it until it's unlocked.
  * @param parameter The Global MIDI Parameter to lock.
  * @param isLocked If the parameter should be locked.
  */
  lockMIDIParameter = lockMIDIParameterInternal.bind(this);
  /**
  * Sets a system parameter of the synthesizer.
  * @param type The type of the system parameter to set.
  * @param value The value to set for the system parameter.
  */
  setSystemParameter = setSystemParameterInternal$1.bind(this);
  systemExclusive = systemExclusiveInternal.bind(this);
  /**
  * The synthesizer's reverb processor.
  */
  reverbProcessor;
  /**
  * The synthesizer's chorus processor.
  */
  chorusProcessor;
  /**
  * The synthesizer's delay processor.
  */
  delayProcessor;
  /**
  * A sysEx may set a "Part" (channel) to receive on a different channel number.
  * This slows down the access, so this toggle tracks if it's enabled or not.
  */
  customChannelNumbers = false;
  /**
  * Sets a global MIDI parameter of the synthesizer.
  * @param parameter The type of the global MIDI parameter to set.
  * @param value The value to set for the global MIDI parameter.
  */
  setMIDIParameter = setMIDIParameterInternal.bind(this);
  /**
  * The fallback processor when the requested insertion is not available.
  */
  insertionFallback = new ThruFX();
  /**
  * The current insertion processor.
  */
  insertionProcessor = this.insertionFallback;
  /**
  * All the insertion effects available to the processor.
  * The key is the EFX type stored as MSB << 8 | LSB
  */
  insertionEffects = /* @__PURE__ */ new Map();
  /**
  * Insertion is not used outside SC-88Pro+ MIDIs, this is an optimization.
  */
  insertionActive = false;
  /**
  * For F5 system exclusive.
  */
  portSelectChannelOffset = 0;
  /**
  * For insertion snapshot tracking
  * 20 parameters (0-19) + 3 sends
  * Index to gs is Addr3 - 3 (for example EFX PARAMETER 1 is 0x03 and here it's 0)
  * note: 255 means "no change"
  * @protected
  */
  insertionParams = new Uint8Array(23).fill(255);
  /**
  * Last time the priorities were assigned.
  * Used to prevent assigning priorities multiple times when more than one voice is triggered during a quantum.
  */
  lastPriorityAssignmentTime = 0;
  /**
  * Synth's event queue from the main thread
  */
  eventQueue = [];
  /**
  * The time of a single sample, in seconds.
  */
  sampleTime;
  constructor(eventCallbackHandler, missingPresetHandler, sampleRate, options) {
    this.eventCallbackHandler = eventCallbackHandler;
    this.missingPresetHandler = missingPresetHandler;
    this.sampleRate = sampleRate;
    this.sampleTime = 1 / sampleRate;
    this.currentTime = options.initialTime;
    this.setSystemParameter("effectsEnabled", options.effectsEnabled);
    this.setSystemParameter("eventsEnabled", options.eventsEnabled);
    this.maxBufferSize = options.maxBufferSize;
    this.gainSmoothingFactor = GAIN_SMOOTHING_FACTOR * (44100 / sampleRate);
    this.panSmoothingFactor = PAN_SMOOTHING_FACTOR * (44100 / sampleRate);
    LowpassFilter.initCache(this.sampleRate);
    const bufSize = this.maxBufferSize;
    this.reverbProcessor = options.reverbProcessor ?? new SpessaSynthReverb(sampleRate, bufSize);
    this.chorusProcessor = options.chorusProcessor ?? new SpessaSynthChorus(sampleRate, bufSize);
    this.delayProcessor = options.delayProcessor ?? new SpessaSynthDelay(sampleRate, bufSize);
    this.voiceBuffer = new Float32Array(bufSize);
    this.insertionInputL = new Float32Array(bufSize);
    this.insertionInputR = new Float32Array(bufSize);
    this.reverbInput = new Float32Array(bufSize);
    this.chorusInput = new Float32Array(bufSize);
    this.delayInput = new Float32Array(bufSize);
    for (const insertion of INSERTION_EFFECT_LIST) this.registerInsertionProcessor(insertion);
    this.resetInsertionParams();
    this.allocateNewVoices(this.systemParameters.voiceCap);
  }
  /**
  * Current total amount of voices that are playing.
  */
  _voiceCount = 0;
  /**
  * Current total amount of voices that are playing.
  */
  get voiceCount() {
    return this._voiceCount;
  }
  controllerChange(channel, controller, value) {
    if (this.customChannelNumbers) {
      for (const ch of this.midiChannels) if (ch.midiParameters.rxChannel === channel) ch.controllerChange(controller, value);
      return;
    }
    this.midiChannels[channel + this.portSelectChannelOffset].controllerChange(controller, value);
  }
  noteOn(channel, midiNote, velocity) {
    if (this.customChannelNumbers) {
      for (const ch of this.midiChannels) if (ch.midiParameters.rxChannel === channel) ch.noteOn(midiNote, velocity);
      return;
    }
    this.midiChannels[channel + this.portSelectChannelOffset].noteOn(midiNote, velocity);
  }
  noteOff(channel, midiNote) {
    if (this.customChannelNumbers) {
      for (const ch of this.midiChannels) if (ch.midiParameters.rxChannel === channel) ch.noteOff(midiNote);
      return;
    }
    this.midiChannels[channel + this.portSelectChannelOffset].noteOff(midiNote);
  }
  polyPressure(channel, midiNote, pressure) {
    if (this.customChannelNumbers) {
      for (const ch of this.midiChannels) if (ch.midiParameters.rxChannel === channel) ch.polyPressure(midiNote, pressure);
      return;
    }
    this.midiChannels[channel + this.portSelectChannelOffset].polyPressure(midiNote, pressure);
  }
  channelPressure(channel, pressure) {
    if (this.customChannelNumbers) {
      for (const ch of this.midiChannels) if (ch.midiParameters.rxChannel === channel) ch.setMIDIParameter("pressure", pressure);
      return;
    }
    this.midiChannels[channel + this.portSelectChannelOffset].setMIDIParameter("pressure", pressure);
  }
  pitchWheel(channel, pitch, midiNote = -1) {
    if (this.customChannelNumbers) {
      for (const ch of this.midiChannels) if (ch.midiParameters.rxChannel === channel) ch.pitchWheel(pitch, midiNote);
      return;
    }
    this.midiChannels[channel + this.portSelectChannelOffset].pitchWheel(pitch, midiNote);
  }
  programChange(channel, programNumber) {
    if (this.customChannelNumbers) {
      for (const ch of this.midiChannels) if (ch.midiParameters.rxChannel === channel) ch.programChange(programNumber);
      return;
    }
    this.midiChannels[channel + this.portSelectChannelOffset].programChange(programNumber);
  }
  /**
  * Assigns the first available voice for use.
  * If none available, will assign priorities.
  */
  assignVoice() {
    for (let i = 0; i < this.systemParameters.voiceCap; i++) {
      const v = this.voices[i];
      if (!v.isActive) {
        v.priority = Infinity;
        return v;
      }
    }
    if (this.systemParameters.autoAllocateVoices) {
      SpessaLog.info(`%cAllocating a new voice, total count %c${this.systemParameters.voiceCap + 1}.`, ConsoleColors.info, ConsoleColors.value);
      this.allocateNewVoices(1);
      const v = this.voices[this.voices.length - 1];
      this.systemParameters.voiceCap++;
      v.priority = Infinity;
      return v;
    }
    this.assignVoicePriorities();
    let lowest = this.voices[0];
    for (let i = 0; i < this.systemParameters.voiceCap; i++) {
      const v = this.voices[i];
      if (v.priority < lowest.priority) lowest = v;
    }
    lowest.priority = Infinity;
    return lowest;
  }
  /**
  * Stops all notes on all channels.
  * @param force if true, all notes are stopped immediately, otherwise they are stopped gracefully.
  */
  stopAllChannels(force) {
    SpessaLog.info("%cStop all received!", ConsoleColors.info);
    for (const channel of this.midiChannels) channel.stopAllNotes(force);
  }
  /**
  * Processes a raw MIDI message.
  * @param message The message to process.
  * @param channelOffset The channel offset for the message.
  * @param options Additional options for scheduling the message.
  */
  processMessage(message, channelOffset = 0, options = DEFAULT_SYNTH_METHOD_OPTIONS) {
    const time = options.time;
    if (time > this.currentTime) {
      this.eventQueue.push({
        message,
        channelOffset,
        time
      });
      this.eventQueue.sort((e1, e2) => e1.time - e2.time);
    } else this.processMessageInternal(message, channelOffset);
  }
  destroySynthProcessor() {
    this.voices.length = 0;
    for (const c of this.midiChannels) c.destroy();
    this.clearCache();
    this.midiChannels.length = 0;
    this.soundBankManager.destroy();
  }
  /**
  * @param channel channel to get voices for
  * @param midiNote the MIDI note to use
  * @param velocity the velocity to use
  * @returns output is an array of Voices
  */
  getVoices(channel, midiNote, velocity) {
    const channelObject = this.midiChannels[channel];
    const overridePatch = this.keyModifierManager.hasOverridePatch(channel, midiNote);
    let preset = channelObject.preset;
    if (overridePatch) {
      const patch = this.keyModifierManager.getPatch(channel, midiNote);
      preset = this.soundBankManager.getPreset(patch, this.midiParameters.system);
    }
    if (!preset) return [];
    return this.getVoicesForPreset(preset, midiNote, velocity);
  }
  createMIDIChannel(sendEvent) {
    const channel = new MIDIChannel(this, this.defaultPreset, this.midiChannels.length);
    this.midiChannels.push(channel);
    if (sendEvent) {
      this.callEvent("channelAdded", void 0);
      channel.setDrums(true);
    }
  }
  /**
  * Executes a full system reset of the synthesizer.
  * This will reset all controllers to their default values,
  * except for the locked controllers.
  * @param system The MIDI system to reset the synthesizer to. Defaults to `gs`.
  */
  reset(system = "gs") {
    this.callEvent("reset", system);
    this.setMIDIParameter("system", system);
    this.setMIDIParameter("volume", 1);
    this.setMIDIParameter("pan", 0);
    this.setMIDIParameter("keyShift", 0);
    this.setMIDIParameter("fineTune", 0);
    this.tunings.fill(-1);
    this.portSelectChannelOffset = 0;
    this.customChannelNumbers = false;
    this.setReverbMacro(4);
    this.setChorusMacro(2);
    this.setDelayMacro(0);
    if (!this.systemParameters.delayLock) this.delayActive = false;
    this.resetInsertion();
    if (!this.drumPreset || !this.defaultPreset) return;
    for (const ch of this.midiChannels) ch.reset(false);
  }
  process(left, right, startIndex = 0, sampleCount = 0) {
    this.processSplit([[left, right]], left, right, startIndex, sampleCount);
  }
  /**
  * The main rendering pipeline, renders all voices and processes the effects:
  * ```
  *                   ┌────────────────────────────────┐
  *                   │        Voice Processor         │
  *                   └───────────────┬────────────────┘
  *                                   │
  *                   ┌───────────────┴────────────────┐
  *                   │      Insertion Processor       │
  *                   │      (Bypass or Process)       │
  *                   └───────────────┬────────────────┘
  *                                   │
  *              ┌──────────┬─────────┼────────────────────────┐
  *              │          │         │                        │
  *              │          │         𜸊                        │
  *              │          │ ┌───────┴───────┐                │
  *              │          │ │    Chorus     │                │
  *              │          │ │   Processor   ├──────────┐     │
  *              │          │ └─┬──────────┬──┘          │     │
  *              │          │   │          │             │     │
  *              │          │   │          │             │     │
  *              │          │   │          │             │     │
  *              │          │   │          │             │     │
  *              │          │   │          𜸊             𜸊     𜸊
  *              │          │   │ ┌────────┴───────┐   ┌─┴─────┴────────┐
  *              │          └───┼>┤     Delay      ├─>>┤     Reverb     │
  *              │              │ │   Processor    │   │   Processor    │
  *              │              │ └────────┬───────┘   └───────┬────────┘
  *              │              │          │                   │
  *              │              │          │                   │
  *              │              │          │                   │
  *              │              │          │                   │
  *              𜸊              𜸊          𜸊                   𜸊
  *    ┌─────────┴──────────┐ ┌─┴──────────┴───────────────────┴────┐
  *    │  Dry Output Pairs  │ │        Stereo Effects Output        │
  *    └────────────────────┘ └─────────────────────────────────────┘
  * ```
  * The pipeline is quite similar to the one on SC-8850 manual page 78.
  * All output arrays must be the same length, the method will crash otherwise.
  * @param outputs The stereo pairs for each MIDI channel's dry output, will be wrapped if less.
  * @param effectsLeft The left stereo effect output buffer.
  * @param effectsRight The right stereo effect output buffer.
  * @param startIndex The index to start writing at into the output buffer.
  * @param samples The amount of samples to write.
  */
  processSplit(outputs, effectsLeft, effectsRight, startIndex = 0, samples = 0) {
    if (this.eventQueue.length > 0) {
      const time = this.currentTime;
      while (this.eventQueue[0]?.time <= time) {
        const q = this.eventQueue.shift();
        if (q) this.processMessageInternal(q.message, q.channelOffset);
      }
    }
    startIndex = Math.max(startIndex, 0);
    const sampleCount = samples || outputs[0][0].length - startIndex;
    if (sampleCount > this.maxBufferSize) throw new Error(`Requested ${sampleCount} samples, but maxBufferSize is ${this.maxBufferSize}`);
    this.reverbInput.fill(0);
    this.chorusInput.fill(0);
    if (this.delayActive) this.delayInput.fill(0);
    if (this.insertionActive) {
      this.insertionInputL.fill(0);
      this.insertionInputR.fill(0);
    }
    for (const c of this.midiChannels) c.clearVoiceCount();
    this._voiceCount = 0;
    const cap = this.systemParameters.voiceCap;
    const outputCount = outputs.length;
    for (let i = 0; i < cap; i++) {
      const v = this.voices[i];
      const ch = this.midiChannels[v.channel];
      if (!v.isActive) continue;
      const outputIndex = v.channel % outputCount;
      ch.renderVoice(v, this.currentTime, outputs[outputIndex][0], outputs[outputIndex][1], startIndex, sampleCount);
      ch.voiceCount++;
      this._voiceCount++;
    }
    if (this.systemParameters.effectsEnabled) {
      const { chorusInput, delayInput, reverbInput, insertionInputR, insertionInputL } = this;
      if (this.insertionActive) this.insertionProcessor.process(insertionInputL, insertionInputR, effectsLeft, effectsRight, reverbInput, chorusInput, delayInput, startIndex, sampleCount);
      this.chorusProcessor.process(chorusInput, effectsLeft, effectsRight, reverbInput, delayInput, startIndex, sampleCount);
      if (this.delayActive && this.midiParameters.system !== "xg") this.delayProcessor.process(delayInput, effectsLeft, effectsRight, reverbInput, startIndex, sampleCount);
      this.reverbProcessor.process(reverbInput, effectsLeft, effectsRight, startIndex, sampleCount);
    }
    this.currentTime += sampleCount * this.sampleTime;
  }
  /**
  * Gets voices for a preset.
  * @param preset The preset to get voices for.
  * @param midiNote The MIDI note to use.
  * @param velocity The velocity to use.
  * @returns Output is an array of voices.
  */
  getVoicesForPreset(preset, midiNote, velocity) {
    const cached = this.getCachedVoice(preset, midiNote, velocity);
    if (cached !== void 0) return cached;
    const voices = new Array();
    for (const voiceParams of preset.getVoiceParameters(midiNote, velocity)) {
      const sample = voiceParams.sample;
      if (voiceParams.sample.getAudioData() === void 0) {
        SpessaLog.warn(`Discarding invalid sample: ${sample.name}`);
        continue;
      }
      voices.push(new CachedVoice(voiceParams, midiNote, velocity, this.sampleRate));
    }
    this.setCachedVoice(preset, midiNote, velocity, voices);
    return voices;
  }
  clearCache() {
    this.cachedVoices.clear();
  }
  /**
  * Copied callback so MIDI channels can call it.
  */
  callEvent(eventName, eventData) {
    this.eventCallbackHandler(eventName, eventData);
  }
  getInsertionSnapshot() {
    return {
      type: this.insertionProcessor.type,
      params: this.insertionParams.slice()
    };
  }
  resetInsertionParams() {
    this.insertionParams.fill(255);
    this.insertionParams[20] = 40;
    this.insertionParams[21] = 0;
    this.insertionParams[22] = 0;
  }
  resetInsertion() {
    if (this.systemParameters.insertionEffectLock) return;
    this.insertionActive = false;
    this.insertionProcessor = this.insertionFallback;
    this.insertionProcessor.reset();
    this.resetInsertionParams();
    this.insertionProcessor.sendLevelToReverb = 40 / 127 * EFX_SENDS_GAIN_CORRECTION;
    this.insertionProcessor.sendLevelToChorus = 0;
    this.insertionProcessor.sendLevelToDelay = 0;
    this.callEvent("effectChange", {
      effect: "insertion",
      parameter: 0,
      value: this.insertionProcessor.type
    });
  }
  setReverbMacro(macro) {
    if (this.systemParameters.reverbLock) return;
    const rev = this.reverbProcessor;
    rev.level = 64;
    rev.preDelayTime = 0;
    rev.character = macro;
    switch (macro) {
      /**
      * REVERB MACRO is a macro parameter that allows global setting of reverb parameters.
      * When you select the reverb type with REVERB MACRO, each reverb parameter will be set to their most
      * suitable value.
      *
      * Room1, Room2, Room3
      * These reverbs simulate the reverberation of a room. They provide a well-defined
      * spacious reverberation.
      * Hall1, Hall2
      * These reverbs simulate the reverberation of a concert hall. They provide a deeper
      * reverberation than the Room reverbs.
      * Plate
      * This simulates a plate reverb (a studio device using a metal plate).
      * Delay
      * This is a conventional delay that produces echo effects.
      * Panning Delay
      * This is a special delay in which the delayed sounds move left and right.
      * It is effective when you are listening in stereo.
      */
      case 0:
        rev.character = 0;
        rev.preLowpass = 3;
        rev.time = 80;
        rev.delayFeedback = 0;
        rev.preDelayTime = 0;
        break;
      case 1:
        rev.preLowpass = 4;
        rev.time = 56;
        rev.delayFeedback = 0;
        break;
      case 2:
        rev.preLowpass = 0;
        rev.time = 72;
        rev.delayFeedback = 0;
        break;
      case 3:
        rev.preLowpass = 4;
        rev.time = 72;
        rev.delayFeedback = 0;
        break;
      case 4:
        rev.preLowpass = 0;
        rev.time = 64;
        rev.delayFeedback = 0;
        break;
      case 5:
        rev.preLowpass = 0;
        rev.time = 88;
        rev.delayFeedback = 0;
        break;
      case 6:
        rev.preLowpass = 0;
        rev.time = 32;
        rev.delayFeedback = 40;
        break;
      case 7:
        rev.preLowpass = 0;
        rev.time = 64;
        rev.delayFeedback = 32;
        break;
      default:
        SpessaLog.warn(`Invalid reverb macro: ${macro}`);
        return;
    }
    this.callEvent("effectChange", {
      effect: "reverb",
      parameter: "macro",
      value: macro
    });
  }
  setChorusMacro(macro) {
    if (this.systemParameters.chorusLock) return;
    const chr = this.chorusProcessor;
    chr.level = 64;
    chr.preLowpass = 0;
    chr.delay = 127;
    chr.sendLevelToDelay = 0;
    chr.sendLevelToReverb = 0;
    switch (macro) {
      /**
      * CHORUS MACRO is a macro parameter that allows global setting of chorus parameters.
      * When you select the chorus type with CHORUS MACRO, each chorus parameter will be set to their
      * most suitable value.
      *
      * Chorus1, Chorus2, Chorus3, Chorus4
      * These are conventional chorus effects that add spaciousness and depth to the
      * sound.
      * Feedback Chorus
      * This is a chorus with a flanger-like effect and a soft sound.
      * Flanger
      * This is an effect sounding somewhat like a jet airplane taking off and landing.
      * Short Delay
      * This is a delay with a short delay time.
      * Short Delay (FB)
      * This is a short delay with many repeats.
      */
      case 0:
        chr.feedback = 0;
        chr.delay = 112;
        chr.rate = 3;
        chr.depth = 5;
        break;
      case 1:
        chr.feedback = 5;
        chr.delay = 80;
        chr.rate = 9;
        chr.depth = 19;
        break;
      case 2:
        chr.feedback = 8;
        chr.delay = 80;
        chr.rate = 3;
        chr.depth = 19;
        break;
      case 3:
        chr.feedback = 16;
        chr.delay = 64;
        chr.rate = 9;
        chr.depth = 16;
        break;
      case 4:
        chr.feedback = 64;
        chr.delay = 127;
        chr.rate = 2;
        chr.depth = 24;
        break;
      case 5:
        chr.feedback = 112;
        chr.delay = 127;
        chr.rate = 1;
        chr.depth = 5;
        break;
      case 6:
        chr.feedback = 0;
        chr.depth = 127;
        chr.rate = 0;
        chr.depth = 127;
        break;
      case 7:
        chr.feedback = 80;
        chr.depth = 127;
        chr.rate = 0;
        chr.depth = 127;
        break;
      default:
        SpessaLog.warn(`Invalid chorus macro: ${macro}`);
        return;
    }
    this.callEvent("effectChange", {
      effect: "chorus",
      parameter: "macro",
      value: macro
    });
  }
  setDelayMacro(macro) {
    if (this.systemParameters.delayLock) return;
    const dly = this.delayProcessor;
    dly.level = 64;
    dly.preLowpass = 0;
    dly.sendLevelToReverb = 0;
    dly.levelRight = dly.levelLeft = 0;
    dly.levelCenter = 127;
    switch (macro) {
      /**
      * DELAY MACRO is a macro parameter that allows global setting of delay parameters. When you select the delay type with DELAY MACRO, each delay parameter will be set to their most
      * suitable value.
      *
      * Delay1, Delay2, Delay3
      * These are conventional delays. 1, 2 and 3 have progressively longer delay times.
      * Delay4
      * This is a delay with a rather short delay time.
      * Pan Delay1. Pan Delay2. Pan Delay3
      * The delay sound moves between left and right. This is effective when listening in
      * stereo. 1, 2 and 3 have progressively longer delay times.
      * Pan Delay4
      * This is a rather short delay with the delayed sound moving between left and
      * right.
      * It is effective when listening in stereo.
      * Dly To Rev
      * Reverb is added to the delay sound, which moves between left and right.
      * It is effective when listening in stereo.
      * PanRepeat
      * The delay sound moves between left and right,
      * but the pan positioning is different from the effects listed above.
      * It is effective when listening in stereo.
      */
      case 0:
        dly.timeCenter = 97;
        dly.timeRatioRight = dly.timeRatioLeft = 1;
        dly.feedback = 80;
        break;
      case 1:
        dly.timeCenter = 106;
        dly.timeRatioRight = dly.timeRatioLeft = 1;
        dly.feedback = 80;
        break;
      case 2:
        dly.timeCenter = 115;
        dly.timeRatioRight = dly.timeRatioLeft = 1;
        dly.feedback = 72;
        break;
      case 3:
        dly.timeCenter = 83;
        dly.timeRatioRight = dly.timeRatioLeft = 1;
        dly.feedback = 72;
        break;
      case 4:
        dly.timeCenter = 105;
        dly.timeRatioLeft = 12;
        dly.timeRatioRight = 24;
        dly.levelCenter = 0;
        dly.levelLeft = 125;
        dly.levelRight = 60;
        dly.feedback = 74;
        break;
      case 5:
        dly.timeCenter = 109;
        dly.timeRatioLeft = 12;
        dly.timeRatioRight = 24;
        dly.levelCenter = 0;
        dly.levelLeft = 125;
        dly.levelRight = 60;
        dly.feedback = 71;
        break;
      case 6:
        dly.timeCenter = 115;
        dly.timeRatioLeft = 12;
        dly.timeRatioRight = 24;
        dly.levelCenter = 0;
        dly.levelLeft = 120;
        dly.levelRight = 64;
        dly.feedback = 73;
        break;
      case 7:
        dly.timeCenter = 93;
        dly.timeRatioLeft = 12;
        dly.timeRatioRight = 24;
        dly.levelCenter = 0;
        dly.levelLeft = 120;
        dly.levelRight = 64;
        dly.feedback = 72;
        break;
      case 8:
        dly.timeCenter = 109;
        dly.timeRatioLeft = 12;
        dly.timeRatioRight = 24;
        dly.levelCenter = 0;
        dly.levelLeft = 114;
        dly.levelRight = 60;
        dly.feedback = 61;
        dly.sendLevelToReverb = 36;
        break;
      case 9:
        dly.timeCenter = 110;
        dly.timeRatioLeft = 21;
        dly.timeRatioRight = 32;
        dly.levelCenter = 97;
        dly.levelLeft = 127;
        dly.levelRight = 67;
        dly.feedback = 40;
        break;
      default:
        SpessaLog.warn(`Invalid delay macro: ${macro}`);
        return;
    }
    this.callEvent("effectChange", {
      effect: "delay",
      parameter: "macro",
      value: macro
    });
  }
  getCachedVoice(patch, midiNote, velocity) {
    return this.cachedVoices.get(this.getCachedVoiceIndex(patch, midiNote, velocity));
  }
  setCachedVoice(patch, midiNote, velocity, voices) {
    this.cachedVoices.set(this.getCachedVoiceIndex(patch, midiNote, velocity), voices);
  }
  /**
  * Allocates new voices.
  * @param count
  * @protected
  */
  allocateNewVoices(count) {
    for (let i = 0; i < count; i++) this.voices.push(new Voice(this.sampleRate, this.maxBufferSize));
  }
  registerInsertionProcessor(proc) {
    const p = new proc(this.sampleRate, this.maxBufferSize);
    this.insertionEffects.set(p.type, p);
  }
  processMessageInternal(message, channelOffset) {
    const byte = message[0];
    let status;
    let channel = 0;
    if (byte >= 128 && byte < 240) {
      status = byte & 240;
      channel = byte & 15;
    } else status = byte;
    channel += channelOffset;
    switch (status) {
      case MIDIMessageTypes.noteOn: {
        const velocity = message[2];
        if (velocity > 0) this.noteOn(channel, message[1], velocity);
        else this.noteOff(channel, message[1]);
        break;
      }
      case MIDIMessageTypes.noteOff:
        this.noteOff(channel, message[1]);
        break;
      case MIDIMessageTypes.pitchWheel:
        this.pitchWheel(channel, message[2] << 7 | message[1]);
        break;
      case MIDIMessageTypes.controllerChange:
        this.controllerChange(channel, message[1], message[2]);
        break;
      case MIDIMessageTypes.programChange:
        this.programChange(channel, message[1]);
        break;
      case MIDIMessageTypes.polyPressure:
        this.polyPressure(channel, message[1], message[2]);
        break;
      case MIDIMessageTypes.channelPressure:
        this.channelPressure(channel, message[1]);
        break;
      case MIDIMessageTypes.systemExclusive:
        this.systemExclusive(new IndexedByteArray(message.slice(1)), channelOffset);
        break;
      case MIDIMessageTypes.reset:
        this.stopAllChannels(false);
        this.reset();
        break;
      default:
        break;
    }
  }
  /**
  * Assigns priorities to the voices.
  * Gets the priority of a voice based on its channel and state.
  * Higher priority means the voice is more important and should be kept longer.
  */
  assignVoicePriorities() {
    if (this.lastPriorityAssignmentTime === this.currentTime) return;
    SpessaLog.info("%cPolyphony exceeded, stealing voices", ConsoleColors.warn);
    this.lastPriorityAssignmentTime = this.currentTime;
    const cap = this.systemParameters.voiceCap;
    for (let i = 0; i < cap; i++) {
      const voice = this.voices[i];
      voice.priority = 0;
      if (this.midiChannels[voice.channel].drumChannel) voice.priority += 5;
      if (voice.isInRelease) voice.priority -= 5;
      voice.priority += voice.velocity / 25;
      voice.priority -= voice.volEnv.state;
      if (voice.isInRelease) voice.priority -= 5;
      voice.priority -= voice.volEnv.attenuationCb / 200;
    }
  }
  updatePresetList() {
    const mainFont = this.soundBankManager.presetList;
    this.clearCache();
    this.callEvent("presetListChange", mainFont);
    this.getDefaultPresets();
    for (const c of this.midiChannels) {
      const lock = c.systemParameters.presetLock;
      c.setSystemParameter("presetLock", false);
      c.programChange(c.patch.program);
      c.setSystemParameter("presetLock", lock);
    }
    this.reset();
  }
  getDefaultPresets() {
    this.defaultPreset = this.soundBankManager.getPreset({
      bankLSB: 0,
      bankMSB: 0,
      program: 0,
      isGMGSDrum: false
    }, "xg");
    this.drumPreset = this.soundBankManager.getPreset({
      bankLSB: 0,
      bankMSB: 0,
      program: 0,
      isGMGSDrum: true
    }, "gs");
  }
  getCachedVoiceIndex(patch, midiNote, velocity) {
    let bankMSB = patch.bankMSB;
    let bankLSB = patch.bankLSB;
    const { isGMGSDrum, program } = patch;
    if (isGMGSDrum) {
      bankMSB = 128;
      bankLSB = 0;
    }
    return bankMSB + bankLSB * 128 + program * 16384 + 2097152 * midiNote + 268435456 * velocity;
  }
};
var SpessaSynthProcessor = class {
  /**
  * Controls if the processor is fully initialized.
  */
  processorInitialized = stb.isInitialized;
  /**
  * Sample rate in Hertz.
  */
  sampleRate;
  /**
  * Calls when an event occurs.
  * @param event The event that occurred.
  */
  onEventCall;
  /**
  * Renders float32 audio data to stereo outputs; buffer size must be equal or smaller than `maxBufferSize`.
  * All float arrays must have the same length.
  * @param left the left output channel.
  * @param right the right output channel.
  * @param startIndex start offset of the passed arrays, rendering starts at this index, defaults to 0.
  * @param sampleCount the length of the rendered buffer, defaults to float32array length - startOffset.
  */
  process;
  /**
  * Renders float32 audio data to stereo outputs; buffer size must be equal or smaller than `maxBufferSize`.
  * All float arrays must have the same length.
  * @param outputs any number stereo pairs (L, R) to render channels separately into.
  * @param effectsLeft the left stereo effect output buffer.
  * @param effectsRight the left stereo effect output buffer.
  * @param startIndex start offset of the passed arrays, rendering starts at this index, defaults to 0.
  * @param sampleCount the length of the rendered buffer, defaults to float32array length - startOffset.
  */
  processSplit;
  /**
  * Executes a system exclusive message for the synthesizer.
  * @param syx The system exclusive message as an array of bytes.
  * @param channelOffset The channel offset to apply (default is 0).
  */
  systemExclusive;
  /**
  * Executes a MIDI controller change message on the specified channel.
  * @param channel The MIDI channel to change the controller on.
  * @param controller The MIDI controller number (0-127).
  * @param value The value of the controller (0-127).
  */
  controllerChange;
  /**
  * Executes a MIDI Note On message on the specified channel.
  * Starts playing a note.
  * @param channel The MIDI channel to send the note on.
  * @param midiNote The MIDI note number to play.
  * @param velocity The velocity of the note, from 0 to 127.
  * @remarks
  * If the velocity is 0, it will be treated as a Note Off message.
  */
  noteOn;
  /**
  * Executes a MIDI Note Off message on the specified channel.
  * Stops playing a note.
  * @param channel The MIDI channel to send the note off.
  * @param midiNote The MIDI note number to stop playing.
  */
  noteOff;
  /**
  * Executes a MIDI Poly Pressure (Aftertouch) message on the specified channel.
  * This differs from the Channel Pressure in that it's per-note and not for the whole channel.
  * @param channel The MIDI channel to send the poly pressure on.
  * @param midiNote The MIDI note number to apply the pressure to.
  * @param pressure The pressure value, from 0 to 127.
  */
  polyPressure;
  /**
  * Executes a MIDI Channel Pressure (Aftertouch) message on the specified channel.
  * @param channel The MIDI channel to send the channel pressure on.
  * @param pressure The pressure value, from 0 to 127.
  */
  channelPressure;
  /**
  * Executes a MIDI Pitch Wheel message on the specified channel.
  * @param channel The MIDI channel to send the pitch wheel on.
  * @param pitch The new pitch value: 0-16383
  * @param midiNote The MIDI note number (optional), pass -1 for the regular pitch wheel.
  */
  pitchWheel;
  /**
  * Executes a MIDI Program Change message on the specified channel.
  * @param channel The MIDI channel to send the program change on.
  * @param programNumber The program number to change to, from 0 to 127.
  */
  programChange;
  /**
  * Processes a raw MIDI message and allows scheduling it at a specific time.
  * @param message The MIDI message to process.
  * @param channelOffset The channel offset for the message. It will be added to message's channel number if applicable.
  * @param options Additional options for scheduling the message.
  */
  processMessage;
  /**
  * Core synthesis engine.
  */
  synthCore;
  /**
  * For applying the snapshot after an override sound bank too.
  */
  savedSnapshot;
  /**
  * Creates a new synthesizer engine.
  * @param sampleRate sample rate, in Hertz.
  * @param opts the processor's options.
  */
  constructor(sampleRate, opts = {}) {
    const options = fillWithDefaults(opts, DEFAULT_SYNTH_OPTIONS);
    this.sampleRate = sampleRate;
    if (!Number.isFinite(options.initialTime) || !Number.isFinite(sampleRate)) throw new TypeError(`Initial time or sample rate is invalid! initial time: ${options.initialTime}, sample rate: ${sampleRate}`);
    this.synthCore = new SynthesizerCore(this.callEvent.bind(this), this.missingPreset.bind(this), this.sampleRate, options);
    const c = this.synthCore;
    this.process = c.process.bind(c);
    this.processSplit = c.processSplit.bind(c);
    this.systemExclusive = c.systemExclusive.bind(c);
    this.controllerChange = c.controllerChange.bind(c);
    this.noteOn = c.noteOn.bind(c);
    this.noteOff = c.noteOff.bind(c);
    this.polyPressure = c.polyPressure.bind(c);
    this.channelPressure = c.channelPressure.bind(c);
    this.pitchWheel = c.pitchWheel.bind(c);
    this.programChange = c.programChange.bind(c);
    this.processMessage = c.processMessage.bind(c);
    for (let i = 0; i < 16; i++) this.synthCore.createMIDIChannel(false);
    this.processorInitialized.then(() => {
      SpessaLog.info("%cSpessaSynth is ready!", ConsoleColors.recognized);
    });
  }
  /**
  * All MIDI channels of the synthesizer.
  * @readonly
  */
  get midiChannels() {
    return this.synthCore.midiChannels;
  }
  /**
  * The global MIDI parameters of the synthesizer.
  * These are only editable via MIDI messages.
  */
  get midiParameters() {
    return this.synthCore.midiParameters;
  }
  /**
  * The global system parameters of the synthesizer.
  * These are only editable via the API.
  */
  get systemParameters() {
    return this.synthCore.systemParameters;
  }
  /**
  * Current total amount of voices that are currently playing.
  */
  get voiceCount() {
    return this.synthCore.voiceCount;
  }
  /**
  * The current time of the synthesizer, in seconds. You probably should not modify this directly.
  */
  get currentTime() {
    return this.synthCore.currentTime;
  }
  /**
  * Synthesizer's reverb processor.
  */
  get reverbProcessor() {
    return this.synthCore.reverbProcessor;
  }
  /**
  * Synthesizer's chorus processor.
  */
  get chorusProcessor() {
    return this.synthCore.chorusProcessor;
  }
  /**
  * Synthesizer's delay processor.
  */
  get delayProcessor() {
    return this.synthCore.delayProcessor;
  }
  /**
  * The sound bank manager, which manages all sound banks and presets.
  */
  get soundBankManager() {
    return this.synthCore.soundBankManager;
  }
  /**
  * Handles the custom key overrides: velocity and preset
  */
  get keyModifierManager() {
    return this.synthCore.keyModifierManager;
  }
  /**
  * A handler for missing presets during program change. By default, it warns to console.
  * @param patch The MIDI patch that was requested.
  * @param system The MIDI System for the request.
  * @returns If a BasicPreset instance is returned, it will be used by the channel.
  */
  onMissingPreset = (patch, system) => {
    SpessaLog.warn(`No preset found for ${MIDIPatchTools.toMIDIString(patch)}! Did you forget to add a sound bank?`);
  };
  /**
  * Locks or unlocks a given Global MIDI Parameter.
  * This prevents any changes to it until it's unlocked.
  * @param parameter The Global MIDI Parameter to lock.
  * @param isLocked If the parameter should be locked.
  */
  lockMIDIParameter(parameter, isLocked) {
    this.synthCore.lockMIDIParameter(parameter, isLocked);
  }
  /**
  * Sets a system parameter of the synthesizer.
  * @param parameter The type of the system parameter to set.
  * @param value The value to set for the system parameter.
  */
  setSystemParameter(parameter, value) {
    this.synthCore.setSystemParameter(parameter, value);
  }
  /**
  * Executes a full synthesizer reset.
  * This will reset all controllers to their default values,
  * except for the locked controllers.
  */
  reset() {
    this.synthCore.reset();
  }
  /**
  * Applies the snapshot to this `SpessaSynthProcessor` instance.
  * @param snapshot The snapshot to apply.
  */
  applySnapshot(snapshot) {
    this.savedSnapshot = snapshot;
    applySnapshot$1.call(this.synthCore, snapshot);
  }
  /**
  * Gets a synthesizer snapshot from this processor instance.
  */
  getSnapshot() {
    return getSynthesizerSnapshot.call(this.synthCore);
  }
  /**
  * Sets the embedded sound bank.
  * @param bank The sound bank file to set.
  * @param offset The bank offset of the embedded sound bank.
  * @internal
  */
  setEmbeddedSoundBank(bank, offset) {
    const loadedFont = SoundBankLoader.fromArrayBuffer(bank);
    this.synthCore.soundBankManager.addSoundBank(loadedFont, EMBEDDED_SOUND_BANK_ID, offset);
    const order = this.synthCore.soundBankManager.priorityOrder;
    order.pop();
    order.unshift(EMBEDDED_SOUND_BANK_ID);
    this.synthCore.soundBankManager.priorityOrder = order;
    if (this.savedSnapshot !== void 0) this.applySnapshot(this.savedSnapshot);
    SpessaLog.info(`%cEmbedded sound bank set at offset %c${offset}`, ConsoleColors.recognized, ConsoleColors.value);
  }
  /**
  * Removes the embedded sound bank from the synthesizer.
  * @internal
  */
  clearEmbeddedSoundBank() {
    if (this.synthCore.soundBankManager.soundBankList.some((s) => s.id === EMBEDDED_SOUND_BANK_ID)) this.synthCore.soundBankManager.deleteSoundBank(EMBEDDED_SOUND_BANK_ID);
  }
  /**
  * Creates a new MIDI channel and adds it to the synthesizer.
  */
  createMIDIChannel() {
    this.synthCore.createMIDIChannel(true);
  }
  /**
  * Stops all notes on all channels.
  * @param force If true, all notes are stopped immediately, otherwise they are stopped gracefully.
  */
  stopAllChannels(force = false) {
    this.synthCore.stopAllChannels(force);
  }
  /**
  *  Destroy the synthesizer processor, clearing all channels and voices.
  *  This is irreversible, so use with caution.
  */
  destroySynthProcessor() {
    this.synthCore.destroySynthProcessor();
  }
  /**
  * Clears the synthesizer's voice cache.
  */
  clearCache() {
    this.synthCore.clearCache();
  }
  /**
  * Gets voices for a preset.
  * @param preset The preset to get voices for.
  * @param midiNote The MIDI note to use.
  * @param velocity The velocity to use.
  * @returns Output is an array of voices.
  * @remarks
  * This is a public method, but it is only intended to be used by the sequencer.
  * @internal
  */
  getVoicesForPreset(preset, midiNote, velocity) {
    return this.synthCore.getVoicesForPreset(preset, midiNote, velocity);
  }
  /**
  * Calls synth event
  * @param eventName the event name
  * @param eventData the event data
  */
  callEvent(eventName, eventData) {
    this.onEventCall?.({
      type: eventName,
      data: eventData
    });
  }
  missingPreset(patch, system) {
    return this.onMissingPreset(patch, system);
  }
};

// node_modules/spessasynth_lib/dist/index.js
var DEFAULT_SYNTH_CONFIG = {
  eventsEnabled: true,
  oneOutput: false,
  audioNodeCreators: void 0
};
var WORKLET_PROCESSOR_NAME = "spessasynth-worklet-processor";
function fillWithDefaults2(obj, defObj) {
  return {
    ...defObj,
    ...obj
  };
}
var WorkletKeyModifierManagerWrapper = class {
  keyModifiers = [];
  synth;
  constructor(synth) {
    this.synth = synth;
  }
  /**
  * Modifies a single key.
  * @param channel The channel affected. Usually 0-15.
  * @param midiNote The MIDI note to change. 0-127.
  * @param options The key's modifiers.
  */
  addModifier(channel, midiNote, options) {
    const mod = new KeyModifier();
    mod.gain = options?.gain ?? 1;
    mod.velocity = options?.velocity ?? -1;
    mod.patch = fillWithDefaults2(options.patch ?? {}, {
      isGMGSDrum: false,
      bankLSB: -1,
      bankMSB: -1,
      program: -1
    });
    this.keyModifiers[channel] ??= [];
    this.keyModifiers[channel][midiNote] = mod;
    this.sendToWorklet("addMapping", {
      channel,
      midiNote,
      mapping: mod
    });
  }
  /**
  * Gets a key modifier.
  * @param channel The channel affected. Usually 0-15.
  * @param midiNote The MIDI note to change. 0-127.
  * @returns The key modifier if it exists.
  */
  getModifier(channel, midiNote) {
    return this.keyModifiers?.[channel]?.[midiNote];
  }
  /**
  * Deletes a key modifier.
  * @param channel The channel affected. Usually 0-15.
  * @param midiNote The MIDI note to change. 0-127.
  */
  deleteModifier(channel, midiNote) {
    this.sendToWorklet("deleteMapping", {
      channel,
      midiNote
    });
    if (this.keyModifiers[channel]?.[midiNote] === void 0) return;
    this.keyModifiers[channel][midiNote] = void 0;
  }
  /**
  * Clears ALL Modifiers
  */
  clearModifiers() {
    this.sendToWorklet("clearMappings", null);
    this.keyModifiers = [];
  }
  sendToWorklet(type, data) {
    const msg = {
      type,
      data
    };
    this.synth.post({
      type: "keyModifierManager",
      channelNumber: -1,
      data: msg
    });
  }
};
var SoundBankManager2 = class {
  /**
  * All the sound banks, ordered from the most important to the least.
  */
  soundBankList;
  synth;
  /**
  * Creates a new instance of the sound bank manager.
  */
  constructor(synth) {
    this.soundBankList = [];
    this.synth = synth;
  }
  /**
  * The current sound bank priority order.
  * @returns The IDs of the sound banks in the current order.
  */
  get priorityOrder() {
    return this.soundBankList.map((s) => s.id);
  }
  /**
  * Rearranges the sound banks in a given order.
  * @param newList The order of sound banks, a list of identifiers, first overwrites second.
  */
  set priorityOrder(newList) {
    this.sendToWorklet("rearrangeSoundBanks", newList);
    this.soundBankList.sort((a, b) => newList.indexOf(a.id) - newList.indexOf(b.id));
  }
  /**
  * Adds a new sound bank buffer with a given ID.
  * @param soundBankBuffer The sound bank's buffer
  * @param id The sound bank's unique identifier.
  * @param bankOffset The sound bank's bank offset. Default is 0.
  */
  async addSoundBank(soundBankBuffer, id, bankOffset = 0) {
    this.sendToWorklet("addSoundBank", {
      soundBankBuffer,
      bankOffset,
      id
    }, [soundBankBuffer]);
    await this.awaitResponse();
    const found = this.soundBankList.find((s) => s.id === id);
    if (found === void 0) this.soundBankList.push({
      id,
      bankOffset
    });
    else found.bankOffset = bankOffset;
  }
  /**
  * Deletes a sound bank with the given ID.
  * @param id The sound bank to delete.
  */
  async deleteSoundBank(id) {
    if (this.soundBankList.length < 2) {
      SpessaLog.warn("1 sound bank left. Aborting!");
      return;
    }
    if (!this.soundBankList.some((s) => s.id === id)) {
      SpessaLog.warn(`No sound banks with id of "${id}" found. Aborting!`);
      return;
    }
    this.sendToWorklet("deleteSoundBank", id);
    this.soundBankList = this.soundBankList.filter((s) => s.id !== id);
    await this.awaitResponse();
  }
  async awaitResponse() {
    return new Promise((r) => this.synth.awaitWorkerResponse("soundBankManager", r));
  }
  sendToWorklet(type, data, transferable = []) {
    const msg = {
      type: "soundBankManager",
      channelNumber: -1,
      data: {
        type,
        data
      }
    };
    this.synth.post(msg, transferable);
  }
};
var SynthEventHandler = class {
  /**
  * The time delay before an event is called.
  * Set to 0 to disable it.
  */
  timeDelay = 0;
  /**
  * The main list of events.
  * @private
  */
  events = {
    noteOff: /* @__PURE__ */ new Map(),
    noteOn: /* @__PURE__ */ new Map(),
    controllerChange: /* @__PURE__ */ new Map(),
    programChange: /* @__PURE__ */ new Map(),
    polyPressure: /* @__PURE__ */ new Map(),
    stopAll: /* @__PURE__ */ new Map(),
    channelAdded: /* @__PURE__ */ new Map(),
    presetListChange: /* @__PURE__ */ new Map(),
    reset: /* @__PURE__ */ new Map(),
    soundBankError: /* @__PURE__ */ new Map(),
    displayMessage: /* @__PURE__ */ new Map(),
    globalParamChange: /* @__PURE__ */ new Map(),
    channelParamChange: /* @__PURE__ */ new Map(),
    effectChange: /* @__PURE__ */ new Map()
  };
  /**
  * Adds a new event listener.
  * @param event The event to listen to.
  * @param id The unique identifier for the event. It can be used to overwrite existing callback with the same ID.
  * @param callback The callback for the event.
  */
  addEvent(event, id, callback) {
    this.events[event].set(id, callback);
  }
  /**
  * Removes an event listener
  * @param name The event to remove a listener from.
  * @param id The unique identifier for the event to remove.
  */
  removeEvent(name, id) {
    this.events[name].delete(id);
  }
  /**
  * Calls the given event.
  * INTERNAL USE ONLY!
  * @internal
  */
  callEventInternal(name, eventData) {
    const eventList = this.events[name];
    const callback = () => {
      for (const callback2 of eventList.values()) try {
        callback2(eventData);
      } catch (error) {
        console.error(`Error while executing an event callback for ${name}:`, error);
      }
    };
    if (this.timeDelay > 0) setTimeout(callback.bind(this), this.timeDelay * 1e3);
    else callback();
  }
};
var ConsoleColors2 = SpessaSynthCoreUtils.ConsoleColors;
var LibMIDIChannel = class {
  /**
  * This channel number.
  * @private
  */
  channel;
  synth;
  _systemParameters = { ...DEFAULT_CHANNEL_SYSTEM_PARAMETERS };
  /**
  * @internal
  * @param channel
  * @param synth
  */
  constructor(channel, synth) {
    this.channel = channel;
    this.synth = synth;
  }
  _patch = {
    bankMSB: 0,
    bankLSB: 0,
    program: 0,
    isDrum: false,
    isGMGSDrum: false,
    name: ""
  };
  /**
  * The currently selected MIDI patch of the channel.
  * Note that the exact matching preset may not be available, but this represents exactly what MIDI asks for.
  */
  get patch() {
    return this._patch;
  }
  /**
  * @internal
  * @param patch
  */
  set patch(patch) {
    this._patch = patch;
  }
  _midiParameters = { ...DEFAULT_CHANNEL_MIDI_PARAMETERS };
  /**
  * The channel MIDI parameters of this channel.
  * These are only editable via MIDI messages.
  */
  get midiParameters() {
    return this._midiParameters;
  }
  /**
  * The channel system parameters of this channel.
  * These are only editable via the API.
  */
  get systemParameters() {
    return this._systemParameters;
  }
  _voiceCount = 0;
  /**
  * The channel's current voice count.
  */
  get voiceCount() {
    return this._voiceCount;
  }
  /**
  * @internal
  * @param value
  */
  set voiceCount(value) {
    this._voiceCount = value;
  }
  /**
  * Locks or unlocks a given Channel MIDI Parameter.
  * This prevents any changes to it until it's unlocked.
  * @param parameter The Channel MIDI Parameter to lock.
  * @param isLocked If the parameter should be locked.
  */
  lockMIDIParameter(parameter, isLocked) {
    this.synth.post({
      type: "lockChannelMIDIParameter",
      channelNumber: this.channel,
      data: {
        parameter,
        isLocked
      }
    });
  }
  /**
  * Sets a system parameter of the channel.
  * @param parameter The type of the parameter to set.
  * @param value The value to set for the parameter.
  */
  setSystemParameter(parameter, value) {
    this._systemParameters[parameter] = value;
    this.synth.post({
      type: "setChannelSystemParameter",
      channelNumber: this.channel,
      data: {
        parameter,
        value
      }
    });
  }
  /**
  * Causes the given midi channel to ignore controller messages for the given controller number.
  * @param controller 0-127 MIDI CC number.
  * @param isLocked True if locked, false if unlocked.
  */
  lockController(controller, isLocked) {
    this.synth.post({
      channelNumber: this.channel,
      type: "lockController",
      data: {
        controller,
        isLocked
      }
    });
  }
  /**
  * Toggles drums on a given channel.
  * @param isDrum If the channel should be drums.
  */
  setDrums(isDrum) {
    this.synth.post({
      channelNumber: this.channel,
      type: "setDrums",
      data: isDrum
    });
  }
  /**
  * @internal
  * @param parameter
  * @param value
  */
  setMIDIParameter(parameter, value) {
    this._midiParameters[parameter] = value;
  }
  /**
  * @internal
  */
  reset() {
    this._midiParameters = { ...DEFAULT_CHANNEL_MIDI_PARAMETERS };
  }
};
var DEFAULT_SYNTH_METHOD_OPTIONS2 = { time: 0 };
var SPESSASYNTH_LIB_HANDLER = (event) => `SPESSASYNTH_LIB_HANDLE_${event}_${Math.random()}`;
var BasicSynthesizer = class {
  /**
  * Allows managing the sound bank list.
  */
  soundBankManager = new SoundBankManager2(this);
  /**
  * Allows managing key modifications.
  */
  keyModifierManager = new WorkletKeyModifierManagerWrapper(this);
  /**
  * Allows setting up custom event listeners for the synthesizer.
  */
  eventHandler = new SynthEventHandler();
  /**
  * Synthesizer's parent AudioContext instance.
  */
  context;
  /**
  * Synth's current channel properties.
  */
  midiChannels = [];
  /**
  * The current preset list.
  */
  presetList = [];
  /**
  * INTERNAL USE ONLY!
  * @internal
  * All sequencer callbacks
  */
  sequencers = new Array();
  /**
  * Resolves when the synthesizer is ready.
  */
  isReady;
  /**
  * INTERNAL USE ONLY!
  * @internal
  */
  post;
  worklet;
  /**
  * The new channels will have their audio sent to the modulated output by this constant.
  * what does that mean?
  * e.g., if outputsAmount is 16, then channel's 16 audio data will be sent to channel 0
  */
  _outputCount = 16;
  _systemParameters = { ...DEFAULT_GLOBAL_SYSTEM_PARAMETERS };
  resolveMap = /* @__PURE__ */ new Map();
  renderingProgressTracker = /* @__PURE__ */ new Map();
  /**
  * Creates a new instance of a synthesizer.
  * @param worklet The AudioWorkletNode to use.
  * @param postFunction The internal post function.
  * @param config Optional configuration for the synthesizer.
  */
  constructor(worklet, postFunction, config) {
    SpessaLog.info("%cInitializing SpessaSynth synthesizer...", ConsoleColors2.info);
    this.context = worklet.context;
    this.worklet = worklet;
    this.post = postFunction;
    this.isReady = new Promise((resolve) => this.awaitWorkerResponse("sf3Decoder", resolve));
    this.worklet.port.onmessage = (e) => this.handleMessage(e.data);
    for (let i = 0; i < 16; i++) this.addNewChannelInternal(false);
    this.registerInternalEvent("channelAdded", () => {
      this.addNewChannelInternal(false);
    });
    this.registerInternalEvent("presetListChange", (e) => this.presetList = [...e]);
    this.registerInternalEvent("globalParamChange", (e) => this._midiParameters[e.parameter] = e.value);
    this.registerInternalEvent("channelParamChange", (e) => this.midiChannels[e.channel].setMIDIParameter(e.parameter, e.value));
    this.registerInternalEvent("programChange", (e) => this.midiChannels[e.channel].patch = { ...e });
    this.registerInternalEvent("reset", () => {
      for (const c of this.midiChannels) c.reset();
      this._midiParameters = { ...DEFAULT_GLOBAL_MIDI_PARAMETERS };
    });
  }
  _midiParameters = { ...DEFAULT_GLOBAL_MIDI_PARAMETERS };
  /**
  * The global MIDI parameters of the synthesizer.
  * These are only editable via MIDI messages.
  */
  get midiParameters() {
    return this._midiParameters;
  }
  /**
  * The current channel count of the synthesizer.
  */
  get channelCount() {
    return this.midiChannels.length;
  }
  /**
  * Current voice amount
  */
  _voiceCount = 0;
  /**
  * The current number of voices playing.
  */
  get voiceCount() {
    return this._voiceCount;
  }
  /**
  * The audioContext's current time.
  */
  get currentTime() {
    return this.context.currentTime;
  }
  /**
  * The global system parameters of the synthesizer.
  * These are only editable via the API.
  */
  get systemParameters() {
    return this._systemParameters;
  }
  /**
  * Connects from a given node.
  * @param destinationNode The node to connect to.
  */
  connect(destinationNode) {
    for (let i = 0; i < 17; i++) this.worklet.connect(destinationNode, i);
    return destinationNode;
  }
  /**
  * Disconnects from a given node.
  * @param destinationNode The node to disconnect from.
  */
  disconnect(destinationNode) {
    if (!destinationNode) {
      this.worklet.disconnect();
      return;
    }
    for (let i = 0; i < 17; i++) this.worklet.disconnect(destinationNode, i);
    return destinationNode;
  }
  /**
  * Sets the SpessaSynth's log level in the processor.
  * @param enableInfo Enable info (verbose)
  * @param enableWarning Enable warnings (unrecognized messages)
  * @param enableGroup Enable groups (to group a lot of logs)
  */
  setLogLevel(enableInfo, enableWarning, enableGroup) {
    this.post({
      channelNumber: -1,
      type: "setLogLevel",
      data: {
        enableInfo,
        enableWarning,
        enableGroup
      }
    });
  }
  /**
  * Locks or unlocks a given Global MIDI Parameter.
  * This prevents any changes to it until it's unlocked.
  * @param parameter The Global MIDI Parameter to lock.
  * @param isLocked If the parameter should be locked.
  */
  lockMIDIParameter(parameter, isLocked) {
    this.post({
      type: "lockGlobalMIDIParameter",
      data: {
        parameter,
        isLocked
      },
      channelNumber: -1
    });
  }
  /**
  * Sets a system parameter to a given value.
  * @param parameter The parameter to set.
  * @param value The value to set.
  */
  setSystemParameter(parameter, value) {
    this._systemParameters[parameter] = value;
    this.post({
      type: "setGlobalSystemParameter",
      channelNumber: -1,
      data: {
        parameter,
        value
      }
    });
  }
  /**
  * Gets a complete snapshot of the synthesizer, effects.
  */
  async getSnapshot() {
    return new Promise((resolve) => {
      this.awaitWorkerResponse("synthesizerSnapshot", (s) => {
        resolve(s);
      });
      this.post({
        type: "requestSynthesizerSnapshot",
        data: null,
        channelNumber: -1
      });
    });
  }
  /**
  * Adds a new channel to the synthesizer.
  */
  addNewChannel() {
    this.addNewChannelInternal(true);
  }
  /**
  * Connects a given channel output to the given audio node.
  * Note that this output is only meant for visualization and may be silent when Insertion Effect for this channel is enabled.
  * @param targetNode The node to connect to.
  * @param channelNumber The channel number to connect to, will be rolled over if value is greater than 15.
  * @returns The target node.
  */
  connectChannel(targetNode, channelNumber) {
    this.worklet.connect(targetNode, channelNumber % 16 + 1);
    return targetNode;
  }
  /**
  * Disconnects a given channel output to the given audio node.
  * @param targetNode The node to disconnect from.
  * @param channelNumber The channel number to connect to, will be rolled over if value is greater than 15.
  */
  disconnectChannel(targetNode, channelNumber) {
    this.worklet.disconnect(targetNode, channelNumber % 16 + 1);
  }
  /**
  * Connects the individual audio outputs to the given audio nodes.
  * Note that these outputs is only meant for visualization and may be silent when Insertion Effect for this channel is enabled.
  * @param audioNodes Exactly 16 outputs.
  */
  connectIndividualOutputs(audioNodes) {
    if (audioNodes.length !== this._outputCount) throw new Error(`input nodes amount differs from the system's outputs amount!
            Expected ${this._outputCount} got ${audioNodes.length}`);
    for (let channel = 0; channel < this._outputCount; channel++) this.connectChannel(audioNodes[channel], channel);
  }
  /**
  * Disconnects the individual audio outputs from the given audio nodes.
  * @param audioNodes Exactly 16 outputs.
  */
  disconnectIndividualOutputs(audioNodes) {
    if (audioNodes.length !== this._outputCount) throw new Error(`input nodes amount differs from the system's outputs amount!
            Expected ${this._outputCount} got ${audioNodes.length}`);
    for (let channel = 0; channel < this._outputCount; channel++) this.disconnectChannel(audioNodes[channel], channel);
  }
  /**
  * Sends a raw MIDI message to the synthesizer.
  * @param message the midi message, each number is a byte.
  * @param channelOffset the channel offset of the message.
  * @param eventOptions additional options for this command.
  */
  sendMessage(message, channelOffset = 0, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS2) {
    this._sendInternal(message, channelOffset, eventOptions);
  }
  /**
  * Starts playing a note
  * @param channel Usually 0-15: the channel to play the note.
  * @param midiNote 0-127 the key number of the note.
  * @param velocity 0-127 the velocity of the note (generally controls loudness).
  * @param eventOptions Additional options for this command.
  */
  noteOn(channel, midiNote, velocity, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS2) {
    const ch = channel % 16;
    const offset = channel - ch;
    midiNote %= 128;
    velocity %= 128;
    this.sendMessage([
      MIDIMessageTypes.noteOn | ch,
      midiNote,
      velocity
    ], offset, eventOptions);
  }
  /**
  * Stops playing a note.
  * @param channel Usually 0-15: the channel of the note.
  * @param midiNote {number} 0-127 the key number of the note.
  * @param eventOptions Additional options for this command.
  */
  noteOff(channel, midiNote, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS2) {
    midiNote %= 128;
    const ch = channel % 16;
    const offset = channel - ch;
    this._sendInternal([MIDIMessageTypes.noteOff | ch, midiNote], offset, eventOptions);
  }
  /**
  * Stops all notes.
  * @param force If the notes should immediately be stopped, defaults to false.
  */
  stopAll(force = false) {
    this.post({
      channelNumber: -1,
      type: "stopAll",
      data: force ? 1 : 0
    });
  }
  /**
  * Changes the given controller
  * @param channel Usually 0-15: the channel to change the controller.
  * @param controller 0-127 the MIDI CC number.
  * @param value 0-127 the controller value.
  * @param eventOptions Additional options for this command.
  */
  controllerChange(channel, controller, value, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS2) {
    if (controller > 127 || controller < 0) throw new Error(`Invalid controller number: ${controller}`);
    value = Math.floor(value) % 128;
    controller = Math.floor(controller) % 128;
    const ch = channel % 16;
    const offset = channel - ch;
    this._sendInternal([
      MIDIMessageTypes.controllerChange | ch,
      controller,
      value
    ], offset, eventOptions);
  }
  /**
  * Fully resets the synthesizer.
  */
  reset() {
    this.post({
      channelNumber: -1,
      type: "ccReset",
      data: null
    });
  }
  /**
  * Applies pressure to a given channel.
  * @param channel Usually 0-15: the channel to change the controller.
  * @param pressure 0-127: the pressure to apply.
  * @param eventOptions Additional options for this command.
  */
  channelPressure(channel, pressure, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS2) {
    const ch = channel % 16;
    const offset = channel - ch;
    pressure %= 128;
    this.sendMessage([MIDIMessageTypes.channelPressure | ch, pressure], offset, eventOptions);
  }
  /**
  * Applies pressure to a given note.
  * @param channel Usually 0-15: the channel to change the controller.
  * @param midiNote 0-127: the MIDI note.
  * @param pressure 0-127: the pressure to apply.
  * @param eventOptions Additional options for this command.
  */
  polyPressure(channel, midiNote, pressure, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS2) {
    const ch = channel % 16;
    const offset = channel - ch;
    midiNote %= 128;
    pressure %= 128;
    this.sendMessage([
      MIDIMessageTypes.polyPressure | ch,
      midiNote,
      pressure
    ], offset, eventOptions);
  }
  /**
  * Sets the pitch of the given channel.
  * @param channel Usually 0-15: the channel to change pitch.
  * @param value The bend of the MIDI pitch wheel message. 0 - 16384
  * @param eventOptions Additional options for this command.
  */
  pitchWheel(channel, value, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS2) {
    const ch = channel % 16;
    const offset = channel - ch;
    this.sendMessage([
      MIDIMessageTypes.pitchWheel | ch,
      value & 127,
      value >> 7
    ], offset, eventOptions);
  }
  /**
  * Sets the channel's pitch wheel range, in semitones.
  * @param channel Usually 0-15: the channel to change.
  * @param range The bend range in semitones.
  * @param eventOptions Additional options for this command.
  */
  pitchWheelRange(channel, range, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS2) {
    this.controllerChange(channel, MIDIControllers.registeredParameterMSB, 0, eventOptions);
    this.controllerChange(channel, MIDIControllers.registeredParameterLSB, 0, eventOptions);
    this.controllerChange(channel, MIDIControllers.dataEntryMSB, range);
    this.controllerChange(channel, MIDIControllers.registeredParameterMSB, 127, eventOptions);
    this.controllerChange(channel, MIDIControllers.registeredParameterLSB, 127, eventOptions);
    this.controllerChange(channel, MIDIControllers.dataEntryMSB, 0, eventOptions);
  }
  /**
  * Changes the program for a given channel
  * @param channel Usually 0-15: the channel to change.
  * @param programNumber 0-127 the MIDI patch number.
  * @param eventOptions Additional options for this command.
  */
  programChange(channel, programNumber, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS2) {
    const ch = channel % 16;
    const offset = channel - ch;
    programNumber %= 128;
    this.sendMessage([MIDIMessageTypes.programChange | ch, programNumber], offset, eventOptions);
  }
  /**
  * Sends a MIDI Sysex message to the synthesizer.
  * @param messageData The message's data, excluding the F0 byte, but including the F7 at the end.
  * @param channelOffset Channel offset for the system exclusive message, defaults to zero.
  * @param eventOptions Additional options for this command.
  */
  systemExclusive(messageData, channelOffset = 0, eventOptions = DEFAULT_SYNTH_METHOD_OPTIONS2) {
    this._sendInternal([MIDIMessageTypes.systemExclusive, ...Array.from(messageData)], channelOffset, eventOptions);
  }
  /**
  * Tune MIDI keys of a given program using the MIDI Tuning Standard.
  * @param program  0 - 127 the MIDI program number to use.
  * @param tunings The keys and their tunings.
  * TargetPitch of -1 sets the tuning for this key to be tuned regularly.
  */
  tuneKeys(program, tunings) {
    if (tunings.length > 127) throw new Error("Too many tunings. Maximum allowed is 127.");
    const systemExclusive = [
      127,
      16,
      8,
      2,
      program,
      tunings.length
    ];
    for (const tuning of tunings) {
      systemExclusive.push(tuning.sourceKey);
      if (tuning.targetPitch === -1) systemExclusive.push(127, 127, 127);
      else {
        const midiNote = Math.floor(tuning.targetPitch);
        const fraction = Math.floor((tuning.targetPitch - midiNote) / 61e-6);
        systemExclusive.push(midiNote, fraction >> 7 & 127, fraction & 127);
      }
    }
    systemExclusive.push(247);
    this.systemExclusive(systemExclusive);
  }
  /**
  * Yes please!
  */
  reverbateEverythingBecauseWhyNot() {
    for (let i = 0; i < this.midiChannels.length; i++) {
      this.controllerChange(i, MIDIControllers.reverbDepth, 127);
      this.midiChannels[i].lockController(MIDIControllers.reverbDepth, true);
    }
    return "That's the spirit!";
  }
  /**
  * INTERNAL USE ONLY!
  * @param type INTERNAL USE ONLY!
  * @param resolve INTERNAL USE ONLY!
  * @internal
  */
  awaitWorkerResponse(type, resolve) {
    this.resolveMap.set(type, resolve);
  }
  /**
  * INTERNAL USE ONLY!
  * @param callback the sequencer callback
  * @internal
  */
  assignNewSequencer(callback) {
    this.post({
      channelNumber: -1,
      type: "requestNewSequencer",
      data: null
    });
    this.sequencers.push(callback);
    return this.sequencers.length - 1;
  }
  assignProgressTracker(type, progressFunction) {
    if (this.renderingProgressTracker.get(type)) throw new Error("Something is already being rendered!");
    this.renderingProgressTracker.set(type, progressFunction);
  }
  revokeProgressTracker(type) {
    this.renderingProgressTracker.delete(type);
  }
  _sendInternal(message, channelOffset, eventOptions) {
    const options = fillWithDefaults2(eventOptions, DEFAULT_SYNTH_METHOD_OPTIONS2);
    this.post({
      type: "midiMessage",
      channelNumber: -1,
      data: {
        messageData: new Uint8Array(message),
        channelOffset,
        options
      }
    });
  }
  /**
  * Handles the messages received from the worklet.
  */
  handleMessage(m) {
    switch (m.type) {
      case "eventCall":
        this.eventHandler.callEventInternal(m.data.type, m.data.data);
        break;
      case "sequencerReturn":
        this.sequencers[m.data.id]?.(m.data);
        break;
      case "voiceCountChange":
        for (let i = 0; i < m.data.length; i++) {
          this.midiChannels[i].voiceCount = m.data[i];
          this._voiceCount = m.data.reduce((s, v) => s + v, 0);
        }
        break;
      case "isFullyInitialized":
        this.workletResponds(m.data.type, m.data.data);
        break;
      case "soundBankError":
        SpessaLog.warn(m.data);
        this.eventHandler.callEventInternal("soundBankError", m.data);
        break;
      case "renderingProgress":
        this.renderingProgressTracker.get(m.data.type)?.(m.data.data);
    }
  }
  addNewChannelInternal(post) {
    this.midiChannels.push(new LibMIDIChannel(this.midiChannels.length, this));
    if (!post) return;
    this.post({
      channelNumber: 0,
      type: "addNewChannel",
      data: null
    });
  }
  workletResponds(type, data) {
    this.resolveMap.get(type)?.(data);
    this.resolveMap.delete(type);
  }
  registerInternalEvent(event, callback) {
    this.eventHandler.addEvent(event, SPESSASYNTH_LIB_HANDLER(event), callback);
  }
};
var WorkletSynthesizer = class extends BasicSynthesizer {
  /**
  * Creates a new instance of an AudioWorklet-based synthesizer.
  * @param context The audio context.
  * @param config Optional configuration for the synthesizer.
  */
  constructor(context, config = DEFAULT_SYNTH_CONFIG) {
    const synthConfig = fillWithDefaults2(config, DEFAULT_SYNTH_CONFIG);
    let outputChannelCount = new Array(17).fill(2);
    let numberOfOutputs = 17;
    if (synthConfig.oneOutput) {
      outputChannelCount = [34];
      numberOfOutputs = 1;
    }
    let worklet;
    try {
      worklet = (synthConfig?.audioNodeCreators?.worklet ?? ((context2, name, options) => {
        return new AudioWorkletNode(context2, name, options);
      }))(context, WORKLET_PROCESSOR_NAME, {
        outputChannelCount,
        numberOfOutputs,
        processorOptions: {
          oneOutput: synthConfig.oneOutput,
          eventsEnabled: synthConfig.eventsEnabled
        }
      });
    } catch (error) {
      console.error(error);
      throw new Error("Could not create the AudioWorkletNode. Did you forget to addModule()?", { cause: error });
    }
    super(worklet, (data, transfer = []) => {
      worklet.port.postMessage(data, transfer);
    }, synthConfig);
  }
  /**
  * Starts an offline audio render.
  * @param config The configuration to use.
  * @remarks
  * Call this method immediately after you've set up the synthesizer.
  * Do NOT call any other methods after initializing before this one.
  * Chromium seems to ignore worklet messages for OfflineAudioContext.
  */
  async startOfflineRender(config) {
    this.post({
      type: "startOfflineRender",
      data: config,
      channelNumber: -1
    }, config.soundBankList.map((b) => b.soundBankBuffer));
    await new Promise((r) => this.awaitWorkerResponse("startOfflineRender", r));
  }
  /**
  * Destroys the synthesizer instance.
  */
  destroy() {
    this.post({
      channelNumber: 0,
      type: "destroyWorklet",
      data: null
    });
    this.worklet.disconnect();
    delete this.worklet;
  }
};
var PLAYBACK_WORKLET_PROCESSOR_NAME = `spessasynth-playback-worklet-processor`;
function getPlaybackWorkletURL(maxQueuedChunks) {
  const PLAYBACK_WORKLET_CODE = `
const BLOCK_SIZE = 128;

const MAX_QUEUED = ${maxQueuedChunks};

/**
 * An AudioWorkletProcessor that plays back 17 separate streams of stereo audio: effects and 16 dry channels.
 */
class PlaybackProcessor extends AudioWorkletProcessor
{
    
    
    /** @type {Float32Array[]} */
    data = [];
    
    updateRequested = false;
    
    alive = true;
    
    /**
     *
     * @type {MessagePort}
     */
    sentPort;
    
    constructor()
    {
        super();
        
        /**
         * @param e {MessageEvent}
         */
        this.port.onmessage = (e) =>
        {
            if (e.ports.length)
            {
                const sentPort = e.ports[0];
                this.sentPort = sentPort;
                sentPort.onmessage = (e) =>
                {
                    if(e.data === null)
                    {
                        // the worklet is dead
                        this.alive = false;
                    }
                    this.data.push(e.data);
                    this.updateRequested = false;
                    // if we need more, request immediately
                    if (this.data.length < MAX_QUEUED)
                    {
                        this.sentPort.postMessage(null);
                    }
                };
                
            }
        };
    }
    
    // noinspection JSUnusedGlobalSymbols
    /**
     * @param _inputs {[Float32Array, Float32Array][]}
     * @param outputs {[Float32Array, Float32Array][]}
     * @returns {boolean}
     */
    process(_inputs, outputs)
    {
        const data = this.data.shift();
        if (!data)
        {
            return this.alive;
        }
        let offset = 0;
        // decode the data nicely
        for (let i = 0; i < 17; i++)
        {
            outputs[i][0].set(data.subarray(offset, offset + BLOCK_SIZE));
            offset += BLOCK_SIZE;
            outputs[i][1].set(data.subarray(offset, offset + BLOCK_SIZE));
            offset += BLOCK_SIZE;
        }
        
        // if it has already been requested, we need to wait
        if (!this.updateRequested)
        {
            this.sentPort.postMessage(null);
            this.updateRequested = true;
        }
        
        // keep it online
        return this.alive;
    }
}
registerProcessor("${PLAYBACK_WORKLET_PROCESSOR_NAME}", PlaybackProcessor);
    `;
  const blob = new Blob([PLAYBACK_WORKLET_CODE], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}
var DEFAULT_WORKER_RENDER_AUDIO_OPTIONS = {
  extraTime: 2,
  separateChannels: false,
  loopCount: 0,
  progressCallback: void 0,
  preserveSynthParams: true,
  enableEffects: true,
  sequencerID: 0
};
var RENDER_BLOCKS_PER_PROGRESS = 64;
var BLOCK_SIZE$1 = 128;
function renderAudioWorker(sampleRate, options) {
  const rendererSynth = new SpessaSynthProcessor(sampleRate, { eventsEnabled: false });
  for (const entry of this.synthesizer.soundBankManager.soundBankList) rendererSynth.soundBankManager.addSoundBank(entry.soundBank, entry.id, entry.bankOffset);
  rendererSynth.soundBankManager.priorityOrder = this.synthesizer.soundBankManager.priorityOrder;
  this.stopAudioLoop();
  const seq = this.sequencers[options.sequencerID];
  const parsedMid = seq.midiData;
  if (!parsedMid) throw new Error("No MIDI is loaded!");
  const playbackRate = seq.playbackRate;
  const loopStartAbsolute = parsedMid.midiTicksToSeconds(parsedMid.loop.start) / playbackRate;
  const loopDuration = parsedMid.midiTicksToSeconds(parsedMid.loop.end) / playbackRate - loopStartAbsolute;
  const sampleDuration = sampleRate * (parsedMid.duration / playbackRate + options.extraTime + loopDuration * options.loopCount);
  const rendererSeq = new SpessaSynthSequencer(rendererSynth);
  rendererSeq.loopCount = options.loopCount;
  if (options.preserveSynthParams) {
    rendererSeq.playbackRate = seq.playbackRate;
    const snapshot = this.synthesizer.getSnapshot();
    rendererSynth.applySnapshot(snapshot);
  }
  rendererSynth.setSystemParameter("autoAllocateVoices", true);
  rendererSeq.loadNewSongList([parsedMid]);
  rendererSeq.play();
  const wetL = new Float32Array(sampleDuration);
  const wetR = new Float32Array(sampleDuration);
  const returnedChunks = {
    effects: [wetL, wetR],
    dry: []
  };
  const sampleDurationNoLastQuantum = sampleDuration - BLOCK_SIZE$1;
  if (options.separateChannels) {
    const dry = [];
    for (let i = 0; i < 16; i++) {
      const d = [new Float32Array(sampleDuration), new Float32Array(sampleDuration)];
      dry.push(d);
      returnedChunks.dry.push(d);
    }
    let index = 0;
    while (true) {
      for (let i = 0; i < RENDER_BLOCKS_PER_PROGRESS; i++) {
        if (index >= sampleDurationNoLastQuantum) {
          rendererSeq.processTick();
          rendererSynth.processSplit(dry, wetL, wetR, index, sampleDuration - index);
          this.startAudioLoop();
          return returnedChunks;
        }
        rendererSeq.processTick();
        rendererSynth.processSplit(dry, wetL, wetR, index, BLOCK_SIZE$1);
        index += BLOCK_SIZE$1;
      }
      this.postProgress("renderAudio", index / sampleDuration);
    }
  } else {
    const dryL = new Float32Array(sampleDuration);
    const dryR = new Float32Array(sampleDuration);
    const dry = [dryL, dryR];
    returnedChunks.dry.push(dry);
    let index = 0;
    while (true) {
      for (let i = 0; i < RENDER_BLOCKS_PER_PROGRESS; i++) {
        if (index >= sampleDurationNoLastQuantum) {
          rendererSeq.processTick();
          rendererSynth.process(dryL, dryR, index, sampleDuration - index);
          this.startAudioLoop();
          return returnedChunks;
        }
        rendererSeq.processTick();
        rendererSynth.process(dryL, dryR, index, BLOCK_SIZE$1);
        index += BLOCK_SIZE$1;
      }
      this.postProgress("renderAudio", index / sampleDuration);
    }
  }
}
var DEFAULT_BANK_WRITE_OPTIONS = {
  trim: true,
  bankID: "",
  writeEmbeddedSoundBank: true,
  sequencerID: 0
};
var DEFAULT_SF2_WRITE_OPTIONS2 = {
  ...DEFAULT_BANK_WRITE_OPTIONS,
  writeDefaultModulators: true,
  writeExtendedLimits: true,
  compressionAction: "keep",
  compressionQuality: 1,
  software: "SpessaSynth"
};
var DEFAULT_RMIDI_WRITE_OPTIONS2 = {
  ...DEFAULT_BANK_WRITE_OPTIONS,
  applySnapshot: false,
  bankOffset: 0,
  correctBankOffset: true,
  metadata: {},
  format: "sf2",
  ...DEFAULT_SF2_WRITE_OPTIONS2
};
var DEFAULT_DLS_WRITE_OPTIONS = {
  ...DEFAULT_BANK_WRITE_OPTIONS,
  software: "SpessaSynth"
};
var WorkerSynthesizer = class extends BasicSynthesizer {
  /**
  * Time offset for syncing with the synth
  * @private
  */
  timeOffset = 0;
  /**
  * Creates a new instance of a Worker-based synthesizer.
  * @param context The audio context.
  * @param workerPostMessage The postMessage for the worker containing the synthesizer core.
  * @param config Optional configuration for the synthesizer.
  */
  constructor(context, workerPostMessage, config = DEFAULT_SYNTH_CONFIG) {
    const synthConfig = fillWithDefaults2(config, DEFAULT_SYNTH_CONFIG);
    if (synthConfig.oneOutput) throw new Error("One output mode is not supported in the WorkerSynthesizer.");
    let worklet;
    try {
      worklet = (synthConfig?.audioNodeCreators?.worklet ?? ((context2, name, options) => {
        return new AudioWorkletNode(context2, name, options);
      }))(context, PLAYBACK_WORKLET_PROCESSOR_NAME, {
        outputChannelCount: new Array(18).fill(2),
        numberOfOutputs: 18,
        processorOptions: {
          oneOutput: synthConfig.oneOutput,
          eventsEnabled: synthConfig.eventsEnabled
        }
      });
    } catch (error) {
      console.error(error);
      throw new Error("Could not create the AudioWorkletNode. Did you forget to registerPlaybackWorklet()?", { cause: error });
    }
    super(worklet, workerPostMessage, synthConfig);
    const messageChannel = new MessageChannel();
    const workerPort = messageChannel.port1;
    const workletPort = messageChannel.port2;
    this.worklet.port.postMessage(null, [workletPort]);
    workerPostMessage({
      initialTime: this.context.currentTime,
      sampleRate: this.context.sampleRate
    }, [workerPort]);
  }
  get currentTime() {
    return this.context.currentTime + this.timeOffset;
  }
  /**
  * Registers an audio worklet for the WorkerSynthesizer.
  * @param context The context to register the worklet for.
  * @param maxQueueSize The maximum amount of 128-sample chunks to store in the worklet. Higher values result in less breakups but higher latency.
  */
  static async registerPlaybackWorklet(context, maxQueueSize = 20) {
    if (!context?.audioWorklet.addModule) throw new Error("Audio worklet is not supported.");
    return context.audioWorklet.addModule(getPlaybackWorkletURL(maxQueueSize));
  }
  /**
  * Handles a return message from the Worker.
  * @param e The event received from the Worker.
  */
  handleWorkerMessage(e) {
    this.timeOffset = e.currentTime - this.context.currentTime;
    this.handleMessage(e);
  }
  /**
  * Writes a DLS file directly in the worker.
  * @param options Options for writing the file.
  * @returns The file array buffer and its corresponding name.
  */
  async writeDLS(options = DEFAULT_DLS_WRITE_OPTIONS) {
    const writeOptions = fillWithDefaults2(options, DEFAULT_DLS_WRITE_OPTIONS);
    return new Promise((resolve) => {
      this.assignProgressTracker("workerSynthWriteFile", (p) => {
        options.progressFunction?.(p);
      });
      const postOptions = {
        ...writeOptions,
        progressFunction: null
      };
      this.awaitWorkerResponse("workerSynthWriteFile", (data) => {
        this.revokeProgressTracker("workerSynthWriteFile");
        resolve(data);
      });
      this.post({
        type: "writeDLS",
        data: postOptions,
        channelNumber: -1
      });
    });
  }
  /**
  * Writes an SF2/SF3 file directly in the worker.
  * @param options Options for writing the file.
  * @returns The file array buffer and its corresponding name.
  */
  async writeSF2(options = DEFAULT_SF2_WRITE_OPTIONS2) {
    const writeOptions = fillWithDefaults2(options, DEFAULT_SF2_WRITE_OPTIONS2);
    return new Promise((resolve) => {
      this.assignProgressTracker("workerSynthWriteFile", (p) => {
        options.progressFunction?.(p);
      });
      const postOptions = {
        ...writeOptions,
        progressFunction: null
      };
      this.awaitWorkerResponse("workerSynthWriteFile", (data) => {
        this.revokeProgressTracker("workerSynthWriteFile");
        resolve(data);
      });
      this.post({
        type: "writeSF2",
        data: postOptions,
        channelNumber: -1
      });
    });
  }
  /**
  * Writes an embedded MIDI (RMIDI) file directly in the worker.
  * @param options Options for writing the file.
  * @returns The file array buffer.
  */
  async writeRMIDI(options = DEFAULT_RMIDI_WRITE_OPTIONS2) {
    const writeOptions = fillWithDefaults2(options, DEFAULT_RMIDI_WRITE_OPTIONS2);
    return new Promise((resolve) => {
      this.assignProgressTracker("workerSynthWriteFile", (p) => {
        options.progressFunction?.(p);
      });
      const postOptions = {
        ...writeOptions,
        progressFunction: null
      };
      this.awaitWorkerResponse("workerSynthWriteFile", (data) => {
        this.revokeProgressTracker("workerSynthWriteFile");
        resolve(data.binary);
      });
      this.post({
        type: "writeRMIDI",
        data: postOptions,
        channelNumber: -1
      });
    });
  }
  /**
  * Renders the current song in the connected sequencer to Float32 buffers.
  * @param sampleRate The sample rate to use, in Hertz.
  * @param renderOptions Extra options for the render.
  * @returns A single audioBuffer if separate channels were not enabled, otherwise 16.
  * @remarks
  * This stops the synthesizer.
  */
  async renderAudio(sampleRate, renderOptions = DEFAULT_WORKER_RENDER_AUDIO_OPTIONS) {
    const options = fillWithDefaults2(renderOptions, DEFAULT_WORKER_RENDER_AUDIO_OPTIONS);
    if (options.enableEffects && options.separateChannels) throw new Error("Effects cannot be applied to separate channels.");
    return new Promise((resolve) => {
      this.awaitWorkerResponse("renderAudio", (data) => {
        this.revokeProgressTracker("renderAudio");
        const bufferLength = data.dry[0][0].length;
        const dryChannels = data.dry.map((dryPair) => {
          const buffer = new AudioBuffer({
            sampleRate,
            numberOfChannels: 2,
            length: bufferLength
          });
          buffer.copyToChannel(dryPair[0], 0);
          buffer.copyToChannel(dryPair[1], 1);
          return buffer;
        });
        if (options.enableEffects) {
          const buffer = new AudioBuffer({
            sampleRate,
            numberOfChannels: 2,
            length: bufferLength
          });
          buffer.copyToChannel(data.effects[0], 0);
          buffer.copyToChannel(data.effects[1], 1);
          dryChannels.push(buffer);
        }
        resolve(dryChannels);
      });
      this.assignProgressTracker("renderAudio", (p) => {
        options.progressCallback?.(p, 0);
      });
      const strippedOptions = {
        ...options,
        progressCallback: void 0
      };
      this.post({
        type: "renderAudio",
        data: {
          sampleRate,
          options: strippedOptions
        },
        channelNumber: -1
      });
    });
  }
};
var MIDIDataTrack = class extends MIDITrack {
  /**
  * THIS DATA WILL BE EMPTY! USE sequencer.getMIDI() TO GET THE ACTUAL DATA!
  */
  events = [];
  constructor(track) {
    super();
    super.copyFrom(track);
    this.events = [];
  }
};
var MIDIData = class MIDIData2 extends BasicMIDI {
  tracks;
  /**
  * THIS DATA WILL BE EMPTY! USE sequencer.getMIDI() TO GET THE ACTUAL DATA!
  */
  timeline = [];
  /**
  * THIS DATA WILL BE EMPTY! USE sequencer.getMIDI() TO GET THE ACTUAL DATA!
  */
  embeddedSoundBank = void 0;
  /**
  * The byte length of the sound bank if it exists.
  */
  embeddedSoundBankSize;
  constructor(mid) {
    super();
    super.copyMetadataFrom(mid);
    this.tracks = mid.tracks.map((t) => new MIDIDataTrack(t));
    this.embeddedSoundBankSize = mid instanceof MIDIData2 ? mid.embeddedSoundBankSize : mid?.embeddedSoundBank?.byteLength;
  }
};
var songChangeType = {
  shuffleOn: 1,
  shuffleOff: 2,
  index: 3
};
var BasicSynthesizerCore = class {
  synthesizer;
  sequencers = new Array();
  post;
  lastSequencerSync = 0;
  /**
  * For syncing voice counts, implemented separately in the `process()` method.
  * @protected
  */
  voiceCounts = new Array(16).fill(0);
  /**
  * Indicates if the processor is alive.
  * @protected
  */
  alive = false;
  eventsEnabled;
  constructor(sampleRate, options, postMessage) {
    this.synthesizer = new SpessaSynthProcessor(sampleRate, options);
    this.eventsEnabled = options.eventsEnabled ?? false;
    this.post = postMessage;
    this.synthesizer.onEventCall = (event) => {
      if (event.type === "channelAdded") {
        const l = this.synthesizer.midiChannels.length;
        for (let i = this.voiceCounts.length; i < l; i++) this.voiceCounts.push(0);
      }
      this.post({
        type: "eventCall",
        data: event,
        currentTime: this.synthesizer.currentTime
      });
    };
  }
  createNewSequencer() {
    const sequencer = new SpessaSynthSequencer(this.synthesizer);
    const sequencerID = this.sequencers.length;
    this.sequencers.push(sequencer);
    sequencer.onEventCall = (e) => {
      if (!this.eventsEnabled) return;
      if (e.type === "songListChange") {
        const midiDatas = e.data.newSongList.map((s) => {
          return new MIDIData(s);
        });
        this.post({
          type: "sequencerReturn",
          data: {
            type: e.type,
            data: {
              newSongList: midiDatas,
              shuffledSongIndexes: sequencer.shuffledSongIndexes
            },
            id: sequencerID
          },
          currentTime: this.synthesizer.currentTime
        });
        return;
      }
      this.post({
        type: "sequencerReturn",
        data: {
          ...e,
          id: sequencerID
        },
        currentTime: this.synthesizer.currentTime
      });
    };
  }
  postReady(type, data, transferable = []) {
    this.post({
      type: "isFullyInitialized",
      data: {
        type,
        data
      },
      currentTime: this.synthesizer.currentTime
    }, transferable);
  }
  postProgress(type, data) {
    this.post({
      type: "renderingProgress",
      data: {
        type,
        data
      },
      currentTime: this.synthesizer.currentTime
    });
  }
  destroy() {
    this.synthesizer.destroySynthProcessor();
    delete this.synthesizer;
    delete this.sequencers;
  }
  handleMessage(m) {
    const channel = m.channelNumber;
    let channelObject;
    if (channel >= 0) {
      channelObject = this.synthesizer.midiChannels[channel];
      if (channelObject === void 0) {
        SpessaLog.warn(`Trying to access channel ${channel} which does not exist... ignoring!`);
        return;
      }
    }
    switch (m.type) {
      case "midiMessage":
        this.synthesizer.processMessage(m.data.messageData, m.data.channelOffset, m.data.options);
        break;
      case "ccReset":
        this.synthesizer.reset();
        break;
      case "stopAll":
        if (channel === -1) this.synthesizer.stopAllChannels(m.data === 1);
        else channelObject?.stopAllNotes(m.data === 1);
        break;
      case "addNewChannel":
        this.synthesizer.createMIDIChannel();
        break;
      case "lockGlobalMIDIParameter":
        this.synthesizer.lockMIDIParameter(m.data.parameter, m.data.isLocked);
        break;
      case "setGlobalSystemParameter":
        this.synthesizer.setSystemParameter(m.data.parameter, m.data.value);
        break;
      case "lockChannelMIDIParameter":
        channelObject?.lockMIDIParameter(m.data.parameter, m.data.isLocked);
        break;
      case "setChannelSystemParameter":
        channelObject?.setSystemParameter(m.data.parameter, m.data.value);
        break;
      case "setDrums":
        channelObject?.setDrums(m.data);
        break;
      case "lockController":
        channelObject?.lockController(m.data.controller, m.data.isLocked);
        break;
      case "sequencerSpecific": {
        const seq = this.sequencers[m.data.id];
        if (!seq) return;
        const seqMsg = m.data;
        switch (seqMsg.type) {
          default:
            break;
          case "loadNewSongList":
            try {
              const songMap = seqMsg.data.map((s) => {
                if ("duration" in s) return BasicMIDI.copyFrom(s);
                return BasicMIDI.fromArrayBuffer(s.binary, s.fileName);
              });
              seq.loadNewSongList(songMap);
            } catch (error) {
              console.error(error);
              this.post({
                type: "sequencerReturn",
                data: {
                  type: "midiError",
                  data: error,
                  id: m.data.id
                },
                currentTime: this.synthesizer.currentTime
              });
            }
            break;
          case "pause":
            seq.pause();
            break;
          case "play":
            seq.play();
            break;
          case "setTime":
            seq.currentTime = seqMsg.data;
            break;
          case "changeMIDIMessageSending":
            seq.externalMIDIPlayback = seqMsg.data;
            break;
          case "setPlaybackRate":
            seq.playbackRate = seqMsg.data;
            break;
          case "setLoopCount":
            seq.loopCount = seqMsg.data;
            break;
          case "changeSong":
            switch (seqMsg.data.changeType) {
              case songChangeType.shuffleOff:
                seq.shuffleMode = false;
                break;
              case songChangeType.shuffleOn:
                seq.shuffleMode = true;
                break;
              case songChangeType.index:
                if (seqMsg.data.data !== void 0) seq.songIndex = seqMsg.data.data;
                break;
            }
            break;
          case "getMIDI":
            if (!seq.midiData) throw new Error("No MIDI is loaded!");
            this.post({
              type: "sequencerReturn",
              data: {
                type: "getMIDI",
                data: seq.midiData,
                id: m.data.id
              },
              currentTime: this.synthesizer.currentTime
            });
            break;
          case "setSkipToFirstNote":
            seq.skipToFirstNoteOn = seqMsg.data;
            break;
        }
        break;
      }
      case "soundBankManager":
        try {
          const sfManager = this.synthesizer.soundBankManager;
          const sfManMsg = m.data;
          let font;
          switch (sfManMsg.type) {
            case "addSoundBank":
              font = SoundBankLoader.fromArrayBuffer(sfManMsg.data.soundBankBuffer);
              sfManager.addSoundBank(font, sfManMsg.data.id, sfManMsg.data.bankOffset);
              this.postReady("soundBankManager", null);
              break;
            case "deleteSoundBank":
              sfManager.deleteSoundBank(sfManMsg.data);
              this.postReady("soundBankManager", null);
              break;
            case "rearrangeSoundBanks":
              sfManager.priorityOrder = sfManMsg.data;
              this.postReady("soundBankManager", null);
          }
        } catch (error) {
          this.post({
            type: "soundBankError",
            data: error,
            currentTime: this.synthesizer.currentTime
          });
        }
        break;
      case "keyModifierManager": {
        const kmMsg = m.data;
        const man = this.synthesizer.keyModifierManager;
        switch (kmMsg.type) {
          default:
            return;
          case "addMapping":
            man.addMapping(kmMsg.data.channel, kmMsg.data.midiNote, kmMsg.data.mapping);
            break;
          case "clearMappings":
            man.clearMappings();
            break;
          case "deleteMapping":
            man.deleteMapping(kmMsg.data.channel, kmMsg.data.midiNote);
        }
        break;
      }
      case "requestSynthesizerSnapshot": {
        const snapshot = this.synthesizer.getSnapshot();
        this.postReady("synthesizerSnapshot", snapshot);
        break;
      }
      case "requestNewSequencer":
        this.createNewSequencer();
        break;
      case "setLogLevel":
        SpessaLog.setLogLevel(m.data.enableInfo, m.data.enableWarning, m.data.enableGroup);
        break;
      case "destroyWorklet":
        this.alive = false;
        this.synthesizer.destroySynthProcessor();
        this.destroy();
        break;
      default:
        SpessaLog.warn("Unrecognized event!", m);
        break;
    }
  }
};
async function writeSF2Worker(opts) {
  let sf = this.getBank(opts);
  const sq = this.sequencers[opts.sequencerID];
  if (opts.trim) {
    if (!sq.midiData) throw new Error("Sound bank MIDI trimming is enabled but no MIDI is loaded!");
    const sfCopy = BasicSoundBank.copyFrom(sf);
    sfCopy.trim(sq.midiData.getUsedProgramsAndKeys(sfCopy));
    sf = sfCopy;
  }
  let compressionFunction;
  if (this.compressionFunction !== void 0) compressionFunction = (audioData, sampleRate) => this.compressionFunction(audioData, sampleRate, opts.compressionQuality);
  switch (opts.compressionAction) {
    case "keep":
    default:
      break;
    case "compress":
      if (!compressionFunction) {
        const e = /* @__PURE__ */ new Error(`Compression enabled but no compression function has been provided to WorkerSynthesizerCore.`);
        this.post({
          type: "soundBankError",
          data: e,
          currentTime: this.synthesizer.currentTime
        });
        throw e;
      }
      await sf.setSampleFormat({
        compressionFunction,
        format: "compressed",
        progressFunction: (progress) => {
          this.postProgress("workerSynthWriteFile", progress);
          return new Promise((r) => r());
        }
      });
      break;
    case "decompress":
      await sf.setSampleFormat({
        format: "pcm",
        progressFunction: (progress) => {
          this.postProgress("workerSynthWriteFile", progress);
          return new Promise((r) => r());
        }
      });
  }
  return {
    binary: sf.writeSF2({
      ...opts,
      progressFunction: (progress) => {
        this.postProgress("workerSynthWriteFile", progress);
        return new Promise((r) => r());
      }
    }),
    bank: sf
  };
}
function writeDLSWorker(opts) {
  let sf = this.getBank(opts);
  const sq = this.sequencers[opts.sequencerID];
  if (opts.trim) {
    if (!sq.midiData) throw new Error("Sound bank MIDI trimming is enabled but no MIDI is loaded!");
    const sfCopy = BasicSoundBank.copyFrom(sf);
    sfCopy.trim(sq.midiData.getUsedProgramsAndKeys(sfCopy));
    sf = sfCopy;
  }
  return {
    binary: sf.writeDLS({
      ...opts,
      progressFunction: (progress) => {
        this.postProgress("workerSynthWriteFile", progress);
        return new Promise((r) => r());
      }
    }),
    bank: sf
  };
}
async function writeRMIDIWorker(opts) {
  const sq = this.sequencers[opts.sequencerID];
  if (!sq.midiData) throw new Error("No MIDI is loaded!");
  let sf;
  let sfBin;
  if (opts.format === "sf2") {
    const bin = await writeSF2Worker.call(this, opts);
    sfBin = bin.binary;
    sf = bin.bank;
  } else {
    const bin = writeDLSWorker.call(this, opts);
    sfBin = bin.binary;
    sf = bin.bank;
  }
  const mid = BasicMIDI.copyFrom(sq.midiData);
  if (opts.applySnapshot) mid.applySnapshot(this.synthesizer.getSnapshot());
  return mid.writeRMIDI(sfBin, {
    soundBank: sf,
    ...opts
  });
}
var BLOCK_SIZE = 128;
var WorkerSynthesizerCore = class extends BasicSynthesizerCore {
  /**
  * The message port to the playback audio worklet.
  */
  workletMessagePort;
  compressionFunction;
  /**
  * Creates a new worker synthesizer core: the synthesizer that runs in the worker.
  * Most parameters here are provided with the first message that is posted to the worker by the WorkerSynthesizer.
  * @param synthesizerConfiguration The data from the first message sent from WorkerSynthesizer.
  * Listen for the first event and use its data to initialize this class.
  * @param workletMessagePort The first port from the first message sent from WorkerSynthesizer.
  * @param mainThreadCallback postMessage function or similar.
  * @param compressionFunction Optional function for compressing SF3 banks.
  */
  constructor(synthesizerConfiguration, workletMessagePort, mainThreadCallback, compressionFunction) {
    super(synthesizerConfiguration.sampleRate, {
      effectsEnabled: true,
      eventsEnabled: true,
      initialTime: synthesizerConfiguration.initialTime
    }, mainThreadCallback);
    this.workletMessagePort = workletMessagePort;
    this.workletMessagePort.onmessage = this.process.bind(this);
    this.compressionFunction = compressionFunction;
    this.synthesizer.processorInitialized.then(() => {
      this.postReady("sf3Decoder", null);
      this.startAudioLoop();
    });
  }
  /**
  * Handles a message received from the main thread.
  * @param m The message received.
  */
  handleMessage(m) {
    switch (m.type) {
      case "renderAudio": {
        const rendered = renderAudioWorker.call(this, m.data.sampleRate, m.data.options);
        const transferable = [];
        for (const r of rendered.effects) transferable.push(r.buffer);
        for (const d of rendered.dry) transferable.push(...d.map((c) => c.buffer));
        this.postReady("renderAudio", rendered, transferable);
        break;
      }
      case "writeRMIDI":
        this.stopAudioLoop();
        writeRMIDIWorker.call(this, m.data).then((data) => {
          this.postReady("workerSynthWriteFile", {
            binary: data,
            fileName: ""
          }, [data]);
          this.startAudioLoop();
        });
        break;
      case "writeSF2":
        this.stopAudioLoop();
        writeSF2Worker.call(this, m.data).then((data) => {
          this.postReady("workerSynthWriteFile", {
            binary: data.binary,
            fileName: data.bank.soundBankInfo.name + (data.bank.soundBankInfo.version.major === 3 ? ".sf3" : ".sf2")
          }, [data.binary]);
          this.startAudioLoop();
        });
        break;
      case "writeDLS": {
        this.stopAudioLoop();
        const data = writeDLSWorker.call(this, m.data);
        this.postReady("workerSynthWriteFile", {
          binary: data.binary,
          fileName: data.bank.soundBankInfo.name + ".dls"
        }, [data.binary]);
        this.startAudioLoop();
        break;
      }
      default:
        super.handleMessage(m);
    }
  }
  getBank(opts) {
    const sq = this.sequencers[opts.sequencerID];
    const sf = opts.writeEmbeddedSoundBank && sq.midiData?.embeddedSoundBank ? SoundBankLoader.fromArrayBuffer(sq.midiData.embeddedSoundBank) : this.synthesizer.soundBankManager.soundBankList.find((b) => b.id === opts.bankID)?.soundBank;
    if (!sf) {
      const e = /* @__PURE__ */ new Error(`${opts.bankID} does not exist in the sound bank list!`);
      this.post({
        type: "soundBankError",
        data: e,
        currentTime: this.synthesizer.currentTime
      });
      throw e;
    }
    return sf;
  }
  stopAudioLoop() {
    this.synthesizer.stopAllChannels(true);
    for (const seq of this.sequencers) seq.pause();
    this.alive = false;
  }
  startAudioLoop() {
    this.alive = true;
    this.process();
  }
  destroy() {
    this.workletMessagePort.postMessage(null);
    this.stopAudioLoop();
    super.destroy();
  }
  process() {
    if (!this.alive) return;
    const byteStep = BLOCK_SIZE * Float32Array.BYTES_PER_ELEMENT;
    const data = new Float32Array(BLOCK_SIZE * 34);
    let byteOffset = 0;
    const wetR = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
    byteOffset += byteStep;
    const wetL = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
    byteOffset += byteStep;
    const dry = [];
    for (let i = 0; i < 16; i++) {
      const dryL = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
      byteOffset += byteStep;
      const dryR = new Float32Array(data.buffer, byteOffset, BLOCK_SIZE);
      byteOffset += byteStep;
      dry.push([dryL, dryR]);
    }
    for (const seq of this.sequencers) seq.processTick();
    this.synthesizer.processSplit(dry, wetL, wetR);
    this.workletMessagePort.postMessage(data, [data.buffer]);
    const t = this.synthesizer.currentTime;
    if (this.eventsEnabled && t - this.lastSequencerSync > 1) {
      for (let id = 0; id < this.sequencers.length; id++) this.post({
        type: "sequencerReturn",
        data: {
          type: "sync",
          data: this.sequencers[id].currentTime,
          id
        },
        currentTime: t
      });
      this.lastSequencerSync = t;
    }
    const c = this.synthesizer.midiChannels;
    const cv = this.voiceCounts;
    let updateChannels = false;
    for (let i = 0; i < c.length; i++) {
      updateChannels ||= c[i].voiceCount !== cv[i];
      cv[i] = c[i].voiceCount;
    }
    if (updateChannels) this.post({
      type: "voiceCountChange",
      currentTime: t,
      data: cv
    });
  }
};
var DEFAULT_SEQUENCER_OPTIONS = {
  skipToFirstNoteOn: true,
  initialPlaybackRate: 1
};
var SeqEventHandler = class {
  /**
  * The time delay before an event is called.
  * Set to 0 to disable it.
  */
  timeDelay = 0;
  events = {
    songChange: /* @__PURE__ */ new Map(),
    songEnded: /* @__PURE__ */ new Map(),
    metaEvent: /* @__PURE__ */ new Map(),
    timeChange: /* @__PURE__ */ new Map(),
    midiError: /* @__PURE__ */ new Map(),
    textEvent: /* @__PURE__ */ new Map()
  };
  /**
  * Adds a new event listener.
  * @param event The event to listen to.
  * @param id The unique identifier for the event. It can be used to overwrite existing callback with the same ID.
  * @param callback The callback for the event.
  */
  addEvent(event, id, callback) {
    this.events[event].set(id, callback);
  }
  /**
  * Removes an event listener
  * @param name The event to remove a listener from.
  * @param id The unique identifier for the event to remove.
  */
  removeEvent(name, id) {
    this.events[name].delete(id);
  }
  /**
  * Calls the given event.
  * Internal use only.
  * @internal
  */
  callEventInternal(name, eventData) {
    const eventList = this.events[name];
    const callback = () => {
      for (const callback2 of eventList.values()) try {
        callback2(eventData);
      } catch (error) {
        console.error(`Error while executing a sequencer event callback for ${name}:`, error);
      }
    };
    if (this.timeDelay > 0) setTimeout(callback.bind(this), this.timeDelay * 1e3);
    else callback();
  }
};
var Sequencer = class {
  /**
  * The current MIDI data for all songs, like the midiData property.
  */
  songListData = [];
  /**
  * Allows setting up custom event listeners for the sequencer.
  */
  eventHandler = new SeqEventHandler();
  /**
  * Indicates whether the sequencer has finished playing a sequence.
  */
  isFinished = false;
  /**
  * The synthesizer attached to this sequencer.
  */
  synth;
  /**
  * The current MIDI data, with the exclusion of the embedded sound bank and event data.
  */
  midiData;
  /**
  * The MIDI port to play to.
  */
  midiOut;
  isLoading = false;
  /**
  * Indicates if the sequencer is paused.
  * Paused if a number, undefined if playing.
  */
  pausedTime = 0;
  getMIDICallback = void 0;
  highResTimeOffset = 0;
  /**
  * Absolute playback startTime, bases on the synth's time.
  */
  absoluteStartTime;
  /**
  * For sending the messages to the correct SpessaSynthSequencer in core
  */
  sequencerID;
  /**
  * Creates a new MIDI sequencer for playing back MIDI files.
  * @param synth synth to send events to.
  * @param options the sequencer's options.
  */
  constructor(synth, options = DEFAULT_SEQUENCER_OPTIONS) {
    this.synth = synth;
    this.absoluteStartTime = this.synth.currentTime;
    this.sequencerID = this.synth.assignNewSequencer(this.handleMessage.bind(this));
    this._skipToFirstNoteOn = options?.skipToFirstNoteOn ?? true;
    if (options?.initialPlaybackRate !== 1) this.playbackRate = options?.initialPlaybackRate ?? 1;
    if (!this._skipToFirstNoteOn) this.sendMessage("setSkipToFirstNote", false);
    window.addEventListener("beforeunload", this.resetMIDIOutput.bind(this));
  }
  _shuffledSongIndexes = [];
  /**
  * The shuffled song indexes.
  * This is used when shuffleMode is enabled.
  */
  get shuffledSongIndexes() {
    return this._shuffledSongIndexes;
  }
  _songIndex = 0;
  /**
  * The current song number in the playlist.
  * If shuffle Mode is enabled, this is the index of the shuffled song list.
  */
  get songIndex() {
    return this._songIndex;
  }
  /**
  * The current song number in the playlist.
  * If shuffle Mode is enabled, this is the index of the shuffled song list.
  */
  set songIndex(value) {
    const clamped = Math.max(0, value % this._songCount);
    if (clamped === this._songIndex) return;
    this.isLoading = true;
    this.midiData = void 0;
    this.sendMessage("changeSong", {
      changeType: songChangeType.index,
      data: clamped
    });
  }
  _currentTempo = 120;
  /**
  * Current song's tempo in BPM.
  */
  get currentTempo() {
    return this._currentTempo;
  }
  /**
  * The current sequence's length, in seconds.
  */
  get duration() {
    return this.midiData?.duration ?? 0;
  }
  _songCount = 0;
  get songCount() {
    return this._songCount;
  }
  _skipToFirstNoteOn;
  /**
  * Indicates if the sequencer should skip to first note on.
  */
  get skipToFirstNoteOn() {
    return this._skipToFirstNoteOn;
  }
  /**
  * Indicates if the sequencer should skip to first note on.
  */
  set skipToFirstNoteOn(val) {
    this._skipToFirstNoteOn = val;
    this.sendMessage("setSkipToFirstNote", this._skipToFirstNoteOn);
  }
  /**
  * Internal loop count marker (-1 is infinite).
  */
  _loopCount = -1;
  /**
  * The current remaining number of loops. -1 means infinite looping.
  */
  get loopCount() {
    return this._loopCount;
  }
  /**
  * The current remaining number of loops. -1 means infinite looping.
  */
  set loopCount(val) {
    this._loopCount = val;
    this.sendMessage("setLoopCount", val);
  }
  /**
  * Controls the playback's rate.
  */
  _playbackRate = 1;
  /**
  * Controls the playback's rate.
  */
  get playbackRate() {
    return this._playbackRate;
  }
  /**
  * Controls the playback's rate.
  */
  set playbackRate(value) {
    const t = this.currentTime;
    this.sendMessage("setPlaybackRate", value);
    this.highResTimeOffset *= value / this._playbackRate;
    this._playbackRate = value;
    this.recalculateStartTime(t);
  }
  _shuffleSongs = false;
  /**
  * Controls if the sequencer should shuffle the songs in the song list.
  * If true, the sequencer will play the songs in a random order.
  *
  * Songs are shuffled on a `loadNewSongList` call.
  */
  get shuffleSongs() {
    return this._shuffleSongs;
  }
  /**
  * Controls if the sequencer should shuffle the songs in the song list.
  * If true, the sequencer will play the songs in a random order.
  *
  * Songs are shuffled on a `loadNewSongList` call.
  */
  set shuffleSongs(value) {
    this._shuffleSongs = value;
    if (value) this.sendMessage("changeSong", { changeType: songChangeType.shuffleOn });
    else this.sendMessage("changeSong", { changeType: songChangeType.shuffleOff });
  }
  /**
  * Current playback time, in seconds.
  */
  get currentTime() {
    if (this.isLoading) return 0;
    if (this.pausedTime !== void 0) return this.pausedTime;
    return (this.synth.currentTime - this.absoluteStartTime) * this._playbackRate;
  }
  /**
  * Current playback time, in seconds.
  */
  set currentTime(time) {
    this.sendMessage("setTime", time);
  }
  /**
  * A smoothed version of currentTime.
  * Use for visualization as it's not affected by the audioContext stutter.
  */
  get currentHighResolutionTime() {
    if (this.pausedTime !== void 0) return this.pausedTime;
    const highResTimeOffset = this.highResTimeOffset;
    const absoluteStartTime = this.absoluteStartTime;
    const performanceElapsedTime = (performance.now() / 1e3 - absoluteStartTime) * this._playbackRate;
    let currentPerformanceTime = highResTimeOffset + performanceElapsedTime;
    const currentAudioTime = this.currentTime;
    const smoothingFactor = 0.01 * this._playbackRate;
    const timeDifference = currentAudioTime - currentPerformanceTime;
    this.highResTimeOffset += timeDifference * smoothingFactor;
    currentPerformanceTime = this.highResTimeOffset + performanceElapsedTime;
    return currentPerformanceTime;
  }
  /**
  * True if paused, false if playing or stopped.
  */
  get paused() {
    return this.pausedTime !== void 0;
  }
  /**
  * Gets the current MIDI File.
  */
  async getMIDI() {
    return new Promise((resolve) => {
      this.getMIDICallback = resolve;
      this.sendMessage("getMIDI", null);
    });
  }
  /**
  * Loads a new song list.
  * @param midiBuffers The MIDI files to play.
  */
  loadNewSongList(midiBuffers) {
    this.isLoading = true;
    this.midiData = void 0;
    this.sendMessage("loadNewSongList", midiBuffers);
    this._songIndex = 0;
    this._songCount = midiBuffers.length;
  }
  /**
  * Connects a given output to the sequencer.
  * @param output The output to connect. Pass undefined to use the connected synthesizer.
  */
  connectMIDIOutput(output) {
    this.resetMIDIOutput();
    this.midiOut = output;
    this.sendMessage("changeMIDIMessageSending", output !== void 0);
  }
  /**
  * Pauses the playback.
  */
  pause() {
    if (this.paused) return;
    this.pausedTime = this.currentTime;
    this.sendMessage("pause", null);
  }
  /**
  * Starts or resumes the playback.
  */
  play() {
    this.recalculateStartTime(this.pausedTime ?? 0);
    this.pausedTime = void 0;
    this.isFinished = false;
    this.sendMessage("play", null);
  }
  handleMessage(m) {
    switch (m.type) {
      case "midiMessage": {
        const midiEventData = m.data.message;
        if (this.midiOut && midiEventData[0] >= 128) {
          this.midiOut.send(midiEventData);
          return;
        }
        break;
      }
      case "songChange": {
        this._songIndex = m.data.songIndex;
        const idx = this._shuffleSongs ? this._shuffledSongIndexes[this._songIndex] : this._songIndex;
        const songChangeData = this.songListData[idx];
        this.midiData = songChangeData;
        this.isLoading = false;
        this.absoluteStartTime = 0;
        this.callEventInternal("songChange", songChangeData);
        break;
      }
      case "sync":
        if (Math.abs(m.data - this.currentTime) > 0.05) this.recalculateStartTime(m.data);
        break;
      case "timeChange": {
        const time = m.data.newTime;
        this.recalculateStartTime(time);
        this.callEventInternal("timeChange", time);
        break;
      }
      case "pause":
        this.pausedTime = this.currentTime;
        this.isFinished = m.data.isFinished;
        if (this.isFinished) this.callEventInternal("songEnded", null);
        break;
      case "midiError":
        this.callEventInternal("midiError", m.data);
        break;
      case "getMIDI":
        if (this.getMIDICallback) this.getMIDICallback(BasicMIDI.copyFrom(m.data));
        break;
      case "metaEvent": {
        const event = m.data.event;
        switch (event.statusByte) {
          case MIDIMessageTypes.setTempo:
            this._currentTempo = 6e7 / SpessaSynthCoreUtils.readBigEndian(event.data, 3);
            break;
          case MIDIMessageTypes.text:
          case MIDIMessageTypes.lyric:
          case MIDIMessageTypes.copyright:
          case MIDIMessageTypes.trackName:
          case MIDIMessageTypes.marker:
          case MIDIMessageTypes.cuePoint:
          case MIDIMessageTypes.instrumentName:
          case MIDIMessageTypes.programName: {
            if (!this.midiData) break;
            let lyricsIndex = -1;
            if (event.statusByte === MIDIMessageTypes.lyric) lyricsIndex = Math.min(this.midiData.lyrics.findIndex((l) => l.ticks === event.ticks), this.midiData.lyrics.length - 1);
            if (this.midiData.isKaraokeFile && (event.statusByte === MIDIMessageTypes.text || event.statusByte === MIDIMessageTypes.lyric)) lyricsIndex = Math.min(this.midiData.lyrics.findIndex((l) => l.ticks === event.ticks), this.midiData.lyrics.length);
            this.callEventInternal("textEvent", {
              event,
              lyricsIndex
            });
            break;
          }
        }
        this.callEventInternal("metaEvent", {
          event: m.data.event,
          trackNumber: m.data.trackIndex
        });
        break;
      }
      case "loopCountChange":
        this._loopCount = m.data.newCount;
        break;
      case "songListChange":
        this.songListData = m.data.newSongList.map((m2) => new MIDIData(m2));
        this._shuffledSongIndexes = m.data.shuffledSongIndexes;
        break;
      default:
        break;
    }
  }
  callEventInternal(type, data) {
    this.eventHandler.callEventInternal(type, data);
  }
  resetMIDIOutput() {
    if (!this.midiOut) return;
    for (let i = 0; i < 16; i++) {
      this.midiOut.send([
        MIDIMessageTypes.controllerChange | i,
        MIDIControllers.allNotesOff,
        0
      ]);
      this.midiOut.send([
        MIDIMessageTypes.controllerChange | i,
        MIDIControllers.resetAllControllers,
        0
      ]);
    }
    this.midiOut.send([MIDIMessageTypes.systemExclusive, ...MIDIUtils.gs(64, 0, 127, [0])]);
  }
  recalculateStartTime(time) {
    this.absoluteStartTime = this.synth.currentTime - time / this._playbackRate;
    this.highResTimeOffset = (this.synth.currentTime - performance.now() / 1e3) * this._playbackRate;
    if (this.paused) this.pausedTime = time;
  }
  sendMessage(messageType, messageData) {
    this.synth.post({
      channelNumber: -1,
      type: "sequencerSpecific",
      data: {
        type: messageType,
        data: messageData,
        id: this.sequencerID
      }
    });
  }
};
function audioBufferToWav(audioBuffer, options) {
  const channels = [];
  const channelOffset = options?.channelOffset ?? 0;
  const channelCount = options?.channelCount ?? audioBuffer.numberOfChannels;
  for (let i = channelOffset; i < audioBuffer.numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
    if (channels.length >= channelCount) break;
  }
  return new Blob([audioToWav(channels, audioBuffer.sampleRate, options)], { type: "audio/wav" });
}
var LibMIDIPort = class {
  port;
  constructor(port) {
    this.port = port;
  }
  /**
  *
  */
  get id() {
    return this.port.id;
  }
  /**
  *
  */
  get name() {
    return this.port.name;
  }
  /**
  *
  */
  get manufacturer() {
    return this.port.manufacturer;
  }
  /**
  *
  */
  get version() {
    return this.port.version;
  }
};
var LibMIDIInput = class extends LibMIDIPort {
  connectedSynths = /* @__PURE__ */ new Set();
  constructor(input) {
    super(input);
    input.onmidimessage = (e) => {
      for (const s of this.connectedSynths) if (e.data) s.sendMessage(e.data);
    };
  }
  /**
  * Connects the input to a given synth, listening for all incoming events.
  * @param synth The synth to connect to.
  */
  connect(synth) {
    this.connectedSynths.add(synth);
  }
  /**
  * Disconnects the input from a given synth.
  * @param synth The synth to disconnect from.
  */
  disconnect(synth) {
    this.connectedSynths.delete(synth);
  }
};
var LibMIDIOutput = class extends LibMIDIPort {
  port;
  constructor(output) {
    super(output);
    this.port = output;
  }
  /**
  * Connects a given sequencer to the output, playing back the MIDI file to it.
  * @param seq The sequencer to connect.
  */
  connect(seq) {
    seq.connectMIDIOutput(this.port);
  }
  /**
  * Disconnects sequencer from the output, making it play to the attached Synthesizer instead.
  * @param seq The sequencer to disconnect.
  */
  disconnect(seq) {
    seq.connectMIDIOutput(void 0);
  }
};
var MIDIDeviceHandler = class MIDIDeviceHandler2 {
  /**
  * The available MIDI inputs. ID maps to the input.
  */
  inputs = /* @__PURE__ */ new Map();
  /**
  * The available MIDI outputs. ID maps to the output.
  */
  outputs = /* @__PURE__ */ new Map();
  constructor(access) {
    for (const [key, value] of access.inputs.entries()) this.inputs.set(key, new LibMIDIInput(value));
    for (const [key, value] of access.outputs.entries()) this.outputs.set(key, new LibMIDIOutput(value));
  }
  /**
  * Attempts to initialize the MIDI Device Handler.
  * @returns The handler.
  * @throws An error if the MIDI Devices fail to initialize.
  */
  static async createMIDIDeviceHandler() {
    if (navigator.requestMIDIAccess) try {
      const response = await navigator.requestMIDIAccess({
        sysex: true,
        software: true
      });
      SpessaLog.info("%cMIDI handler created!", ConsoleColors2.recognized);
      return new MIDIDeviceHandler2(response);
    } catch (error) {
      SpessaLog.warn(`Could not get MIDI Devices:`, error);
      throw error;
    }
    else {
      SpessaLog.warn("Web MIDI API is not supported.", ConsoleColors2.unrecognized);
      throw new Error("Web MIDI API is not supported.");
    }
  }
};
var WebMIDILinkHandler = class {
  /**
  * Initializes support for Web MIDI Link (https://www.g200kg.com/en/docs/webmidilink/)
  * @param synth The synthesizer to enable support with.
  */
  constructor(synth) {
    window.addEventListener("message", (msg) => {
      if (typeof msg.data !== "string") return;
      const data = msg.data.split(",");
      if (data[0] !== "midi") return;
      data.shift();
      const midiData = data.map((byte) => Number.parseInt(byte, 16));
      synth.sendMessage(midiData);
    });
    SpessaLog.info("%cWeb MIDI Link handler created!", ConsoleColors2.recognized);
  }
};
export {
  DEFAULT_SYNTH_CONFIG,
  MIDIDeviceHandler,
  Sequencer,
  WebMIDILinkHandler,
  WorkerSynthesizer,
  WorkerSynthesizerCore,
  WorkletSynthesizer,
  audioBufferToWav
};
