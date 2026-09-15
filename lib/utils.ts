import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";
import { id } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatIDR(value: string | number | bigint | null | undefined): string {
  const n = typeof value === "string" ? (value === "" ? 0 : Number(value)) : Number(value ?? 0);
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return format(new Date(value), "dd MMM yyyy", { locale: id });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return format(new Date(value), "dd MMM yyyy HH:mm", { locale: id });
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return format(new Date(value), "HH:mm", { locale: id });
}

export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: id });
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function parseAmount(value: string | number): number {
  if (typeof value === "number") return value;
  return Number(value || 0);
}

export function money(value: string | number): string {
  return String(Number(value || 0));
}

export function genderLabel(g: string | null | undefined): string {
  if (g === "MALE") return "Laki-laki";
  if (g === "FEMALE") return "Perempuan";
  return "-";
}

export function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}