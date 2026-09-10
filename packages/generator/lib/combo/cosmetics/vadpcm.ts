export type VadpcmBook = {
  order: number;
  npredictors: number;
  data: Int16Array;
};

type ExpandedBook = number[][][];

function readU32BE(data: Uint8Array, offset: number) {
  return (
      (data[offset] << 24) |
      (data[offset + 1] << 16) |
      (data[offset + 2] << 8) |
      data[offset + 3]
  ) >>> 0;
}

function readI16BE(data: Uint8Array, offset: number) {
  let value = (data[offset] << 8) | data[offset + 1];

  if (value >= 0x8000) {
    value -= 0x10000;
  }

  return value;
}

export function readVadpcmBook(
    font: Uint8Array,
    offset: number,
): VadpcmBook {
  if (!offset || offset + 8 > font.length) {
    throw new Error(`Invalid VADPCM book pointer 0x${offset.toString(16)}`);
  }

  const order = readU32BE(font, offset);
  const npredictors = readU32BE(font, offset + 4);

  if (order < 1 || order > 8) {
    throw new Error(`Unsupported VADPCM order ${order}`);
  }

  if (npredictors < 1 || npredictors > 16) {
    throw new Error(`Unsupported VADPCM predictor count ${npredictors}`);
  }

  const count = 8 * order * npredictors;
  const end = offset + 8 + count * 2;

  if (end > font.length) {
    throw new Error('VADPCM book extends past the soundfont');
  }

  const data = new Int16Array(count);

  for (let i = 0; i < count; ++i) {
    data[i] = readI16BE(font, offset + 8 + i * 2);
  }

  return {
    order,
    npredictors,
    data,
  };
}

function expandBook(book: VadpcmBook): ExpandedBook {
  const table: ExpandedBook = [];
  let source = 0;

  for (let predictor = 0; predictor < book.npredictors; ++predictor) {
    const page: number[][] = Array.from(
        { length: 8 },
        () => Array(book.order + 8).fill(0),
    );

    for (let column = 0; column < book.order; ++column) {
      for (let row = 0; row < 8; ++row) {
        page[row][column] = book.data[source++];
      }
    }

    for (let row = 1; row < 8; ++row) {
      page[row][book.order] = page[row - 1][book.order - 1];
    }

    page[0][book.order] = 1 << 11;

    for (let shift = 1; shift < 8; ++shift) {
      let row = 0;

      for (; row < shift; ++row) {
        page[row][shift + book.order] = 0;
      }

      for (; row < 8; ++row) {
        page[row][shift + book.order] =
            page[row - shift][book.order];
      }
    }

    table.push(page);
  }

  return table;
}

function innerProduct(
    length: number,
    v1: number[],
    v2: ArrayLike<number>,
) {
  let out = 0;

  for (let i = 0; i < length; ++i) {
    out = (
        out +
        Math.imul(v1[i] | 0, v2[i] | 0)
    ) | 0;
  }

  return Math.floor(out / (1 << 11));
}

function qsample(value: number, scale: number) {
  if (value > 0) {
    return Math.trunc(value / scale + 0.4999999);
  }

  return Math.trunc(value / scale - 0.4999999);
}

function clampBits(value: number, bits: number) {
  const limit = 1 << (bits - 1);

  if (value < -limit) {
    return -limit;
  }

  if (value > limit - 1) {
    return limit - 1;
  }

  return value;
}

function clampRound16(value: number) {
  if (value > 0x7fff) {
    value = 0x7fff;
  }

  if (value < -0x8000) {
    value = -0x8000;
  }

  if (value > 0) {
    return Math.trunc(value + 0.5);
  }

  return Math.trunc(value - 0.5);
}

function encodeFrame(
    input: Int16Array,
    state: Int32Array,
    table: ExpandedBook,
    order: number,
    npredictors: number,
) {
  const inVec = new Int32Array(16);
  const prediction = new Int32Array(16);
  const errors = new Float32Array(16);

  let optimalPredictor = 0;
  let minimumError = Math.fround(1e30);

  for (let predictor = 0; predictor < npredictors; ++predictor) {
    for (let i = 0; i < order; ++i) {
      inVec[i] = state[16 - order + i];
    }

    for (let i = 0; i < 8; ++i) {
      prediction[i] = innerProduct(
          order + i,
          table[predictor][i],
          inVec,
      );

      inVec[i + order] = input[i] - prediction[i];
      errors[i] = inVec[i + order];
    }

    for (let i = 0; i < order; ++i) {
      inVec[i] =
          prediction[8 - order + i] +
          inVec[8 + i];
    }

    for (let i = 0; i < 8; ++i) {
      prediction[8 + i] = innerProduct(
          order + i,
          table[predictor][i],
          inVec,
      );

      inVec[i + order] =
          input[8 + i] -
          prediction[8 + i];

      errors[8 + i] = inVec[i + order];
    }

    let squaredError = Math.fround(0);

    for (let i = 0; i < 16; ++i) {
      squaredError = Math.fround(
          squaredError +
          Math.fround(errors[i] * errors[i]),
      );
    }

    if (squaredError < minimumError) {
      minimumError = squaredError;
      optimalPredictor = predictor;
    }
  }

  for (let i = 0; i < order; ++i) {
    inVec[i] = state[16 - order + i];
  }

  for (let i = 0; i < 8; ++i) {
    prediction[i] = innerProduct(
        order + i,
        table[optimalPredictor][i],
        inVec,
    );

    inVec[i + order] = input[i] - prediction[i];
    errors[i] = inVec[i + order];
  }

  for (let i = 0; i < order; ++i) {
    inVec[i] =
        prediction[8 - order + i] +
        inVec[8 + i];
  }

  for (let i = 0; i < 8; ++i) {
    prediction[8 + i] = innerProduct(
        order + i,
        table[optimalPredictor][i],
        inVec,
    );

    inVec[i + order] =
        input[8 + i] -
        prediction[8 + i];

    errors[8 + i] = inVec[i + order];
  }

  const rounded = errors.map(clampRound16);

  let max = 0;

  for (let i = 0; i < 16; ++i) {
    if (Math.abs(rounded[i]) > Math.abs(max)) {
      max = rounded[i];
    }
  }

  const bits = 4;
  const scaleFactor = 16 - bits;
  const lower = -(1 << (bits - 1));
  const upper = -lower - 1;

  let scale = 0;

  for (; scale <= scaleFactor; ++scale) {
    if (max <= upper && max >= lower) {
      break;
    }

    max = Math.trunc(max / 2);
  }

  const savedState = Int32Array.from(state);
  const quantized = new Int16Array(16);

  scale -= 1;

  let iteration = 0;
  let maxClip = 0;

  do {
    ++iteration;
    maxClip = 0;
    ++scale;

    if (scale > scaleFactor) {
      scale = scaleFactor;
    }

    for (let i = 0; i < order; ++i) {
      inVec[i] =
          savedState[16 - order + i];
    }

    for (let i = 0; i < 8; ++i) {
      prediction[i] = innerProduct(
          order + i,
          table[optimalPredictor][i],
          inVec,
      );

      const error = Math.fround(
          Math.fround(input[i]) -
          Math.fround(prediction[i]),
      );

      quantized[i] = qsample(
          error,
          2 ** scale,
      );

      const correction =
          clampBits(
              quantized[i],
              bits,
          ) -
          quantized[i];

      maxClip = Math.max(
          maxClip,
          Math.abs(correction),
      );

      quantized[i] += correction;

      inVec[i + order] =
          quantized[i] *
          (1 << scale);
      state[i] =
          prediction[i] +
          inVec[i + order];
    }

    for (let i = 0; i < order; ++i) {
      inVec[i] =
          state[8 - order + i];
    }

    for (let i = 0; i < 8; ++i) {
      prediction[8 + i] = innerProduct(
          order + i,
          table[optimalPredictor][i],
          inVec,
      );

      const error = Math.fround(
          Math.fround(input[8 + i]) -
          Math.fround(prediction[8 + i]),
      );

      quantized[8 + i] = qsample(
          error,
          2 ** scale,
      );

      const correction =
          clampBits(
              quantized[8 + i],
              bits,
          ) -
          quantized[8 + i];

      maxClip = Math.max(
          maxClip,
          Math.abs(correction),
      );

      quantized[8 + i] += correction;

      inVec[i + order] =
          quantized[8 + i] *
          (1 << scale);

      state[8 + i] =
          prediction[8 + i] +
          inVec[i + order];
    }
  } while (maxClip >= 2 && iteration < 2);

  const output = new Uint8Array(9);

  output[0] =
      ((scale & 0x0f) << 4) |
      (optimalPredictor & 0x0f);

  for (let i = 0; i < 16; i += 2) {
    output[1 + i / 2] =
        ((quantized[i] & 0x0f) << 4) |
        (quantized[i + 1] & 0x0f);
  }

  return output;
}

export function encodeVadpcm(
    pcm: Int16Array,
    book: VadpcmBook,
) {
  if (!pcm.length) {
    return new Uint8Array(0);
  }

  const table = expandBook(book);
  const state = new Int32Array(16);
  const frameCount = Math.ceil(pcm.length / 16);
  const output = new Uint8Array(frameCount * 9);

  for (let frame = 0; frame < frameCount; ++frame) {
    const input = new Int16Array(16);
    const start = frame * 16;
    const count = Math.min(
        16,
        pcm.length - start,
    );

    input.set(
        pcm.subarray(
            start,
            start + count,
        )
    );

    output.set(
        encodeFrame(
            input,
            state,
            table,
            book.order,
            book.npredictors,
        ),
        frame * 9,
    );
  }

  return output;
}
