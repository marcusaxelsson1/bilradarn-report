export const money = (value) => `${new Intl.NumberFormat("sv-SE").format(Math.round(value || 0))} kr`;
export const shortMoney = (value) => `${Math.round((value || 0) / 1000)}k`;
export const stamp = (iso) => new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
export const palette = ["#136fca", "#078f89", "#d97706", "#7950b3", "#d64562"];
