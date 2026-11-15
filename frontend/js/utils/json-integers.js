// Preserve integer tokens beyond JS precision before JSON.parse can round them.
// Quoted JSON strings (including escaped quotes/digits) are copied untouched.
export function parseJsonIntegers(source) {
    let output = '', quoted = false, escaped = false;
    for (let index = 0; index < source.length;) {
        const char = source[index];
        if (quoted) {
            output += char; index++;
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') quoted = false;
        } else if (char === '"') { quoted = true; output += char; index++; }
        else if (char === '-' || /[0-9]/.test(char)) {
            const token = source.slice(index).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/)?.[0];
            if (!token) { output += char; index++; continue; }
            const integer = /^-?[0-9]+$/.test(token);
            output += integer && (BigInt(token) > BigInt(Number.MAX_SAFE_INTEGER) || BigInt(token) < BigInt(Number.MIN_SAFE_INTEGER)) ? JSON.stringify(token) : token;
            index += token.length;
        } else { output += char; index++; }
    }
    return JSON.parse(output);
}

export function accountId(value) {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('INVALID_RESPONSE');
    if (!['string', 'number'].includes(typeof value) || !/^[1-9][0-9]*$/.test(String(value)) || BigInt(value) > 9223372036854775807n) throw new Error('INVALID_RESPONSE');
    return String(value);
}
