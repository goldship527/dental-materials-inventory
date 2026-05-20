const LEFT_ODD_PATTERNS: Record<string, string> = {
  "0": "0001101",
  "1": "0011001",
  "2": "0010011",
  "3": "0111101",
  "4": "0100011",
  "5": "0110001",
  "6": "0101111",
  "7": "0111011",
  "8": "0110111",
  "9": "0001011",
};

const LEFT_EVEN_PATTERNS: Record<string, string> = {
  "0": "0100111",
  "1": "0110011",
  "2": "0011011",
  "3": "0100001",
  "4": "0011101",
  "5": "0111001",
  "6": "0000101",
  "7": "0010001",
  "8": "0001001",
  "9": "0010111",
};

const RIGHT_PATTERNS: Record<string, string> = {
  "0": "1110010",
  "1": "1100110",
  "2": "1101100",
  "3": "1000010",
  "4": "1011100",
  "5": "1001110",
  "6": "1010000",
  "7": "1000100",
  "8": "1001000",
  "9": "1110100",
};

const PARITY_PATTERNS: Record<string, string> = {
  "0": "OOOOOO",
  "1": "OOEOEE",
  "2": "OOEEOE",
  "3": "OOEEEO",
  "4": "OEOOEE",
  "5": "OEEOOE",
  "6": "OEEEOO",
  "7": "OEOEOE",
  "8": "OEOEEO",
  "9": "OEEOEO",
};

export type Ean13Bar = {
  x: number;
  width: number;
  isGuard: boolean;
};

export function calculateEan13CheckDigit(first12Digits: string) {
  if (!/^\d{12}$/.test(first12Digits)) {
    return null;
  }

  const sum = first12Digits.split("").reduce((total, digit, index) => {
    const value = Number(digit);
    return total + value * (index % 2 === 0 ? 1 : 3);
  }, 0);

  return String((10 - (sum % 10)) % 10);
}

export function isValidEan13(value: string) {
  if (!/^\d{13}$/.test(value)) {
    return false;
  }

  return calculateEan13CheckDigit(value.slice(0, 12)) === value[12];
}

export function calculateGtin14CheckDigit(first13Digits: string) {
  if (!/^\d{13}$/.test(first13Digits)) {
    return null;
  }

  const sum = first13Digits.split("").reduce((total, digit, index) => {
    const value = Number(digit);
    return total + value * (index % 2 === 0 ? 3 : 1);
  }, 0);

  return String((10 - (sum % 10)) % 10);
}

export function isValidGtin14(value: string) {
  if (!/^\d{14}$/.test(value)) {
    return false;
  }

  return calculateGtin14CheckDigit(value.slice(0, 13)) === value[13];
}

export function encodeEan13(value: string) {
  if (!isValidEan13(value)) {
    return null;
  }

  const firstDigit = value[0];
  const leftDigits = value.slice(1, 7).split("");
  const rightDigits = value.slice(7).split("");
  const parity = PARITY_PATTERNS[firstDigit];
  const leftPattern = leftDigits
    .map((digit, index) => (parity[index] === "O" ? LEFT_ODD_PATTERNS[digit] : LEFT_EVEN_PATTERNS[digit]))
    .join("");
  const rightPattern = rightDigits.map((digit) => RIGHT_PATTERNS[digit]).join("");

  return `101${leftPattern}01010${rightPattern}101`;
}

export function getEan13Bars(value: string): Ean13Bar[] {
  const pattern = encodeEan13(value);

  if (!pattern) {
    return [];
  }

  const bars: Ean13Bar[] = [];
  let currentBarStart: number | null = null;

  for (let index = 0; index <= pattern.length; index += 1) {
    const bit = pattern[index];

    if (bit === "1" && currentBarStart === null) {
      currentBarStart = index;
    }

    if ((bit !== "1" || index === pattern.length) && currentBarStart !== null) {
      bars.push({
        x: currentBarStart,
        width: index - currentBarStart,
        isGuard: currentBarStart < 3 || (currentBarStart >= 45 && currentBarStart < 50) || currentBarStart >= 92,
      });
      currentBarStart = null;
    }
  }

  return bars;
}
