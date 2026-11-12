/* ==========================================================================
   Age Calculator
   1. Pure helpers (no DOM): date maths + validation
   2. DOM code: reading the form, showing errors, animating the result
   ========================================================================== */

/* ---------- 1. Pure helpers ---------- */

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year, month) {
  // month is 1-12
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isFutureDate(day, month, year, today) {
  if (year !== today.year) return year > today.year;
  if (month !== today.month) return month > today.month;
  return day > today.day;
}

/**
 * Validate the three raw strings from the inputs.
 * Returns { errors, valid }:
 *   errors.day / errors.month / errors.year  -> message for that field ("" if fine)
 *   errors.wholeForm                          -> true when the date as a whole is wrong
 *                                                (e.g. 31/04/1991). All three fields go red,
 *                                                the message shows under "day".
 */
function validateDate(rawDay, rawMonth, rawYear, today) {
  const errors = { day: "", month: "", year: "", wholeForm: false };

  const isNumber = (value) => /^\d+$/.test(value);
  const day = Number(rawDay);
  const month = Number(rawMonth);
  const year = Number(rawYear);

  // Day
  if (rawDay === "") errors.day = "This field is required";
  else if (!isNumber(rawDay) || day < 1 || day > 31) errors.day = "Must be a valid day";

  // Month
  if (rawMonth === "") errors.month = "This field is required";
  else if (!isNumber(rawMonth) || month < 1 || month > 12) errors.month = "Must be a valid month";

  // Year
  if (rawYear === "") errors.year = "This field is required";
  else if (!isNumber(rawYear) || year < 1000) errors.year = "Must be a valid year";
  else if (year > today.year) errors.year = "Must be in the past";

  // If each field is fine on its own, check the date as a whole
  if (!errors.day && !errors.month && !errors.year) {
    if (day > daysInMonth(year, month)) {
      errors.day = "Must be a valid date"; // e.g. 31/04 or 29/02 in a non-leap year
      errors.wholeForm = true;
    } else if (isFutureDate(day, month, year, today)) {
      errors.day = "Must be in the past";
      errors.wholeForm = true;
    }
  }

  const valid = !errors.day && !errors.month && !errors.year;
  return { errors, valid, birth: valid ? { day, month, year } : null };
}

/**
 * Exact age in whole years, months and days.
 * Idea: count whole months first, then count the leftover days from the
 * "month anniversary" to today. If the birth day doesn't exist in that month
 * (e.g. the 31st in April) the anniversary falls on the last day of the month.
 */
function calculateAge(birth, today) {
  let totalMonths = (today.year - birth.year) * 12 + (today.month - birth.month);
  if (today.day < birth.day) totalMonths -= 1;

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  const anniversaryMonthIndex = birth.month - 1 + totalMonths;
  const anniversaryYear = birth.year + Math.floor(anniversaryMonthIndex / 12);
  const anniversaryMonth = (anniversaryMonthIndex % 12) + 1;
  const anniversaryDay = Math.min(birth.day, daysInMonth(anniversaryYear, anniversaryMonth));

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const days = Math.round(
    (Date.UTC(today.year, today.month - 1, today.day) -
      Date.UTC(anniversaryYear, anniversaryMonth - 1, anniversaryDay)) /
      MS_PER_DAY
  );

  return { years, months, days };
}

function getToday() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/* ---------- 2. DOM code ---------- */

const form = document.getElementById("age-form");
const fields = ["day", "month", "year"];
const units = ["years", "months", "days"];
const summary = document.getElementById("result-summary");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const animationFrames = {}; // remembers running animations so a new submit can cancel them

function setFieldError(name, message, isInvalid) {
  const wrapper = document.querySelector(`[data-field="${name}"]`);
  const input = document.getElementById(name);
  const errorEl = document.getElementById(`${name}-error`);

  wrapper.dataset.invalid = String(isInvalid);
  if (isInvalid) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");

  errorEl.textContent = message;
  errorEl.hidden = message === "";
}

function clearErrors() {
  fields.forEach((name) => setFieldError(name, "", false));
}

function showErrors(errors) {
  fields.forEach((name) => {
    const isInvalid = errors.wholeForm || errors[name] !== "";
    setFieldError(name, errors[name], isInvalid);
  });
}

function resetResults() {
  units.forEach((unit) => {
    cancelAnimationFrame(animationFrames[unit]);
    document.getElementById(unit).textContent = "--";
    document.getElementById(`${unit}-label`).textContent = unit;
  });
  summary.textContent = "";
}

// Count up from 0 to the final number (ease-out)
function animateNumber(unit, target) {
  const el = document.getElementById(unit);
  const label = document.getElementById(`${unit}-label`);
  label.textContent = target === 1 ? unit.slice(0, -1) : unit; // "1 year", "2 years"

  cancelAnimationFrame(animationFrames[unit]);

  if (prefersReducedMotion || target === 0) {
    el.textContent = target;
    return;
  }

  const duration = 1000;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * eased);
    if (progress < 1) animationFrames[unit] = requestAnimationFrame(tick);
  }

  animationFrames[unit] = requestAnimationFrame(tick);
}

function showAge(age) {
  units.forEach((unit) => animateNumber(unit, age[unit]));

  const part = (n, word) => `${n} ${n === 1 ? word : word + "s"}`;
  summary.textContent = `You are ${part(age.years, "year")}, ${part(age.months, "month")} and ${part(age.days, "day")} old.`;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const raw = fields.map((name) => document.getElementById(name).value.trim());
  const { errors, valid, birth } = validateDate(...raw, getToday());

  if (!valid) {
    showErrors(errors);
    resetResults();
    const firstInvalid = fields.find((name) => errors.wholeForm || errors[name]);
    document.getElementById(firstInvalid).focus();
    return;
  }

  clearErrors();
  showAge(calculateAge(birth, getToday()));
});

// Only allow digits while typing, and clear old errors as soon as the user edits
fields.forEach((name) => {
  document.getElementById(name).addEventListener("input", (event) => {
    event.target.value = event.target.value.replace(/\D/g, "");
    clearErrors();
  });
});