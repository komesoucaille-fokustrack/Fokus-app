export const K = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const parseK = (k) => { const [a, b, c] = k.split('-').map(Number); return new Date(a, b - 1, c); };
