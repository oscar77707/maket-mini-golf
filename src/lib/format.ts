const TIMEZONE = "Europe/Paris";

export const formatEuro = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

export const formatNumber = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits }).format(value);

export const formatDate = (value: string | Date) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: TIMEZONE }).format(
    new Date(value),
  );

export const formatDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIMEZONE,
  }).format(new Date(value));
