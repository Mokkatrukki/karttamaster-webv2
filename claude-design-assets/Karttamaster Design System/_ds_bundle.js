/* @ds-bundle: {"format":3,"namespace":"KarttamasterDesignSystem_3ae2ca","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"ProgressBar","sourcePath":"components/core/ProgressBar.jsx"},{"name":"Select","sourcePath":"components/core/Select.jsx"},{"name":"StatusBadge","sourcePath":"components/core/StatusBadge.jsx"},{"name":"CheckInButton","sourcePath":"components/map/CheckInButton.jsx"},{"name":"DriveBanner","sourcePath":"components/map/DriveBanner.jsx"},{"name":"MarkerListItem","sourcePath":"components/map/MarkerListItem.jsx"},{"name":"RouteTab","sourcePath":"components/map/RouteTab.jsx"},{"name":"SignMarker","sourcePath":"components/map/SignMarker.jsx"}],"sourceHashes":{"components/core/Button.jsx":"77bc715eb5c9","components/core/Card.jsx":"413cf07fc22b","components/core/IconButton.jsx":"95eab38a7bb3","components/core/Input.jsx":"389bf7e31d88","components/core/ProgressBar.jsx":"ec20d1bfb935","components/core/Select.jsx":"aed7ed1a6125","components/core/StatusBadge.jsx":"c106fe6b83d6","components/map/CheckInButton.jsx":"e9ec008cf552","components/map/DriveBanner.jsx":"5ce312e92c7f","components/map/MarkerListItem.jsx":"9c505fd65fc0","components/map/RouteTab.jsx":"a98079aa953a","components/map/SignMarker.jsx":"f3350c4f1b3e","ui_kits/organizer/MapBackdropOrg.jsx":"272cf9d8c5cf","ui_kits/organizer/OrganizerApp.jsx":"2f4fd95191b4","ui_kits/volunteer/MapBackdrop.jsx":"25f14452ca86","ui_kits/volunteer/VolunteerApp.jsx":"9f609ea43747"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.KarttamasterDesignSystem_3ae2ca = window.KarttamasterDesignSystem_3ae2ca || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Karttamaster Button.
 * Every variant honours the 44px touch floor — this is a gloves-in-the-forest
 * product, so even "small" never goes below the touch minimum in height.
 */
function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  iconLeft = null,
  iconRight = null,
  disabled = false,
  type = 'button',
  style = {},
  children,
  ...rest
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-2)',
    minHeight: size === 'lg' ? '52px' : 'var(--touch-min)',
    padding: size === 'sm' ? 'var(--pad-btn-sm)' : size === 'lg' ? '14px 20px' : 'var(--pad-btn)',
    width: fullWidth ? '100%' : 'auto',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--font-ui)',
    fontSize: size === 'lg' ? 'var(--text-base)' : 'var(--text-sm)',
    fontWeight: 'var(--weight-medium)',
    letterSpacing: 'var(--tracking-btn)',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.45 : 1,
    transition: 'background var(--dur-instant) var(--ease), color var(--dur-instant) var(--ease)'
  };
  const variants = {
    primary: {
      background: 'var(--accent)',
      color: 'var(--accent-text)',
      fontWeight: 'var(--weight-bold)'
    },
    confirm: {
      background: 'var(--confirm)',
      color: 'var(--confirm-text)',
      fontWeight: 'var(--weight-bold)'
    },
    secondary: {
      background: 'var(--field-tint)',
      color: 'var(--text-body)',
      borderColor: 'var(--border-strong)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-muted)',
      borderColor: 'var(--border-default)'
    },
    danger: {
      background: 'var(--danger-soft)',
      color: 'var(--danger-text)',
      borderColor: 'color-mix(in srgb, var(--danger) 25%, transparent)'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    style: {
      ...base,
      ...variants[variant],
      ...style
    }
  }, rest), iconLeft, children && /*#__PURE__*/React.createElement("span", null, children), iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Surface container — modals, dropdowns, panel sections. */
function Card({
  elevation = 'flat',
  padding = 'md',
  style = {},
  children,
  ...rest
}) {
  const shadows = {
    flat: 'none',
    dropdown: 'var(--shadow-dropdown)',
    modal: 'var(--shadow-modal)'
  };
  const pads = {
    none: 0,
    sm: 'var(--space-2)',
    md: 'var(--space-3)',
    lg: 'var(--space-4)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: shadows[elevation],
      padding: pads[padding],
      color: 'var(--text-body)',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * IconButton — a square, icon-only control fixed at the 44px touch target.
 * Used for toolbar overflow (⋯), modal close (✕), route prev/next (◀ ▶),
 * visibility toggles. ALWAYS pass `label` → becomes aria-label (DESIGN.md §A).
 */
function IconButton({
  label,
  variant = 'ghost',
  active = false,
  size = 44,
  disabled = false,
  style = {},
  children,
  ...rest
}) {
  const variants = {
    ghost: {
      background: 'transparent',
      color: 'var(--text-muted)',
      borderColor: 'var(--border-strong)'
    },
    solid: {
      background: 'var(--field-tint)',
      color: 'var(--text-body)',
      borderColor: 'var(--border-default)'
    },
    danger: {
      background: 'var(--danger-soft)',
      color: 'var(--danger-text)',
      borderColor: 'color-mix(in srgb, var(--danger) 25%, transparent)'
    }
  };
  const activeStyle = active ? {
    background: 'var(--accent)',
    color: 'var(--accent-text)',
    borderColor: 'transparent'
  } : {};
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    "aria-pressed": active || undefined,
    disabled: disabled,
    title: label,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: `${size}px`,
      height: `${size}px`,
      minWidth: 'var(--touch-min)',
      minHeight: 'var(--touch-min)',
      padding: 0,
      border: '1px solid transparent',
      borderRadius: 'var(--radius-sm)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '18px',
      lineHeight: 1,
      opacity: disabled ? 0.35 : 1,
      transition: 'background var(--dur-instant) var(--ease), color var(--dur-instant) var(--ease)',
      ...variants[variant],
      ...activeStyle,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Field-grade text input. 44px tall, accent focus ring, full-width by default. */
function Input({
  label = null,
  hint = null,
  invalid = false,
  style = {},
  id,
  ...rest
}) {
  const inputId = id || (label ? `in-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-1)',
      width: '100%'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontSize: 'var(--text-meta)',
      fontWeight: 'var(--weight-medium)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-caps)',
      color: 'var(--text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    "aria-invalid": invalid || undefined,
    style: {
      width: '100%',
      minHeight: 'var(--touch-min)',
      padding: '10px 12px',
      background: 'var(--surface-app)',
      color: 'var(--text-body)',
      border: `1px solid ${invalid ? 'var(--danger)' : 'var(--border-default)'}`,
      borderRadius: 'var(--radius-sm)',
      fontFamily: 'var(--font-ui)',
      fontSize: 'var(--text-base)',
      outline: 'none',
      boxSizing: 'border-box',
      transition: 'border-color var(--dur-fast) var(--ease)',
      ...style
    },
    onFocus: e => {
      e.target.style.borderColor = 'var(--accent)';
    },
    onBlur: e => {
      e.target.style.borderColor = invalid ? 'var(--danger)' : 'var(--border-default)';
    }
  }, rest)), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-meta)',
      color: invalid ? 'var(--danger-text)' : 'var(--text-meta)'
    }
  }, hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/ProgressBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ProgressBar — route completion + per-route status overview (organizer panel).
 * Thin track with green fill. Optional leading label + trailing percent/detail.
 */
function ProgressBar({
  value = 0,
  label = null,
  pct = null,
  detail = null,
  height = 6,
  fill = 'var(--confirm)',
  style = {},
  ...rest
}) {
  const v = Math.max(0, Math.min(100, value));
  const shownPct = pct == null ? `${Math.round(v)}%` : pct;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      fontSize: 'var(--text-meta)',
      ...style
    }
  }, rest), label != null && /*#__PURE__*/React.createElement("span", {
    style: {
      width: '44px',
      flexShrink: 0,
      color: 'var(--text-muted)',
      fontWeight: 'var(--weight-medium)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    role: "progressbar",
    "aria-valuenow": Math.round(v),
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    style: {
      flex: 1,
      height: `${height}px`,
      background: 'var(--field-tint)',
      borderRadius: '999px',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${v}%`,
      height: '100%',
      background: fill,
      borderRadius: '999px',
      transition: 'width var(--dur-base) var(--ease)'
    }
  })), shownPct != null && /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: '32px',
      textAlign: 'right',
      color: 'var(--confirm)',
      fontWeight: 'var(--weight-bold)',
      fontVariantNumeric: 'tabular-nums',
      flexShrink: 0
    }
  }, shownPct), detail != null && /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: '40px',
      textAlign: 'right',
      color: 'var(--text-meta)',
      flexShrink: 0,
      fontVariantNumeric: 'tabular-nums'
    }
  }, detail));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/core/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Native select styled to match Input — 44px, marker-type / status pickers. */
function Select({
  label = null,
  style = {},
  id,
  children,
  ...rest
}) {
  const selId = id || (label ? `sel-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-1)',
      width: '100%'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: selId,
    style: {
      fontSize: 'var(--text-meta)',
      fontWeight: 'var(--weight-medium)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-caps)',
      color: 'var(--text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("select", _extends({
    id: selId,
    style: {
      width: '100%',
      minHeight: 'var(--touch-min)',
      padding: '8px 12px',
      background: 'var(--surface-app)',
      color: 'var(--text-body)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-sm)',
      fontFamily: 'var(--font-ui)',
      fontSize: 'var(--text-sm)',
      cursor: 'pointer',
      outline: 'none',
      boxSizing: 'border-box',
      ...style
    }
  }, rest), children));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Select.jsx", error: String((e && e.message) || e) }); }

// components/core/StatusBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STATUS = {
  suunniteltu: {
    label: 'Suunniteltu',
    text: 'var(--status-suunniteltu-text)',
    bg: 'var(--status-suunniteltu-bg)'
  },
  asetettu: {
    label: 'Asetettu',
    text: 'var(--status-asetettu-text)',
    bg: 'var(--status-asetettu-bg)'
  },
  tarkistettu: {
    label: 'Tarkistettu',
    text: 'var(--status-tarkistettu-text)',
    bg: 'var(--status-tarkistettu-bg)'
  },
  keratty: {
    label: 'Kerätty',
    text: 'var(--status-keratty-text)',
    bg: 'var(--status-keratty-bg)'
  },
  ei_tarpeen: {
    label: 'Ei tarpeen',
    text: 'var(--status-ei-tarpeen-text)',
    bg: 'var(--status-ei-tarpeen-bg)'
  }
};

/**
 * StatusBadge — the marker lifecycle pill.
 * suunniteltu → asetettu → tarkistettu → kerätty (+ ei_tarpeen).
 * Colours are AA-tuned per theme via the --status-* tokens.
 */
function StatusBadge({
  status = 'suunniteltu',
  children,
  style = {},
  ...rest
}) {
  const s = STATUS[status] || STATUS.suunniteltu;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-block',
      fontSize: 'var(--text-meta)',
      fontWeight: 'var(--weight-medium)',
      letterSpacing: 'var(--tracking-caps)',
      textTransform: 'uppercase',
      padding: '2px 6px',
      borderRadius: 'var(--radius-sm)',
      color: s.text,
      background: s.bg,
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), children || s.label);
}
Object.assign(__ds_scope, { StatusBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatusBadge.jsx", error: String((e && e.message) || e) }); }

// components/map/CheckInButton.jsx
try { (() => {
/**
 * CheckInButton — the volunteer's dominant field action.
 * One huge green button does the normal thing in a single tap; secondary
 * options ("Ei tarpeen", "Lisäsin toisen") sit smaller beneath. This is the
 * whole point of the volunteer view: max one tap to the common case.
 */
function CheckInButton({
  label = 'Merkitse asetetuksi',
  sub = null,
  onConfirm,
  secondary = [],
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
      width: '100%',
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onConfirm,
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2px',
      width: '100%',
      minHeight: '72px',
      background: 'var(--confirm)',
      color: 'var(--confirm-text)',
      border: 'none',
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      fontFamily: 'var(--font-ui)',
      fontSize: '18px',
      fontWeight: 'var(--weight-bold)',
      letterSpacing: 'var(--tracking-btn)',
      boxShadow: 'var(--shadow-dropdown)',
      transition: 'background var(--dur-instant) var(--ease), transform var(--dur-instant) var(--ease)'
    },
    onMouseDown: e => {
      e.currentTarget.style.transform = 'scale(0.985)';
    },
    onMouseUp: e => {
      e.currentTarget.style.transform = 'scale(1)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = 'scale(1)';
    }
  }, /*#__PURE__*/React.createElement("span", null, label), sub && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-medium)',
      opacity: 0.85
    }
  }, sub)), secondary.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-1-5)'
    }
  }, secondary.map((s, i) => /*#__PURE__*/React.createElement(__ds_scope.Button, {
    key: i,
    variant: s.variant || 'secondary',
    size: "md",
    fullWidth: true,
    onClick: s.onClick,
    style: {
      flex: 1
    }
  }, s.label))));
}
Object.assign(__ds_scope, { CheckInButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/map/CheckInButton.jsx", error: String((e && e.message) || e) }); }

// components/map/DriveBanner.jsx
try { (() => {
/**
 * DriveBanner — GPS drive-mode read-out. "Seuraava merkki 300 m →".
 * Built to be read at a glance, one-handed, in motion. The distance is the
 * single biggest thing on screen; it turns green when you're within range.
 * This is the one sanctioned break from the 11–14px type ceiling.
 */
function DriveBanner({
  distance = '300 m',
  label = 'Seuraava merkki',
  direction = '→',
  near = false,
  action = null,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: '10px 14px',
      borderRadius: 'var(--radius-md)',
      background: near ? 'var(--status-asetettu-bg)' : 'var(--field-tint)',
      border: `1px solid ${near ? 'var(--status-asetettu-text)' : 'var(--border-default)'}`,
      transition: 'background var(--dur-base) var(--ease), border-color var(--dur-base) var(--ease)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      fontSize: 'var(--text-drive-lg)',
      lineHeight: 1,
      color: near ? 'var(--status-asetettu-text)' : 'var(--text-body)',
      flexShrink: 0
    }
  }, direction), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-drive)',
      fontWeight: 'var(--weight-bold)',
      lineHeight: 1,
      color: near ? 'var(--status-asetettu-text)' : 'var(--text-body)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, distance), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-base)',
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, label)), action);
}
Object.assign(__ds_scope, { DriveBanner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/map/DriveBanner.jsx", error: String((e && e.message) || e) }); }

// components/map/MarkerListItem.jsx
try { (() => {
/**
 * MarkerListItem — a single sign row in the marker modal / segment view.
 * Type glyph swatch + name + km meta + status pill, with optional trailing
 * action (delete, chevron). `highlight` flags a just-added marker.
 */
function MarkerListItem({
  glyph = '→',
  hue = 'var(--marker-right)',
  name = 'Nuoli oikealle',
  km = null,
  status = 'asetettu',
  highlight = false,
  trailing = null,
  onClick,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2-5)',
      padding: 'var(--pad-row)',
      minHeight: 'var(--touch-min)',
      borderBottom: '1px solid var(--border-card)',
      background: highlight ? 'var(--warn-highlight)' : 'transparent',
      cursor: onClick ? 'pointer' : 'default',
      color: 'var(--text-body)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '28px',
      height: '28px',
      borderRadius: 'var(--radius-sm)',
      background: hue,
      color: '#fff',
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--weight-bold)',
      flexShrink: 0
    }
  }, glyph), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--weight-medium)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, name), km != null && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-meta)',
      color: 'var(--text-meta)',
      marginTop: '1px',
      fontVariantNumeric: 'tabular-nums'
    }
  }, km)), /*#__PURE__*/React.createElement(__ds_scope.StatusBadge, {
    status: status
  }), trailing);
}
Object.assign(__ds_scope, { MarkerListItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/map/MarkerListItem.jsx", error: String((e && e.message) || e) }); }

// components/map/RouteTab.jsx
try { (() => {
/**
 * RouteTab — a route selector chip in the bottom route-bar.
 * Solid route-hue body with km label + drive glyph, plus a divided
 * visibility (eye) toggle. Active route gets a bright outline; hidden
 * routes dim to 0.35.
 */
function RouteTab({
  label = '55 km',
  color = 'var(--route-1)',
  active = false,
  hidden = false,
  onSelect,
  onToggleVisibility,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
      border: `1.5px solid ${active ? 'rgba(255,255,255,0.65)' : 'transparent'}`,
      background: color,
      opacity: hidden ? 0.35 : 1,
      transition: 'border-color var(--dur-fast) var(--ease), opacity var(--dur-base) var(--ease)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onSelect,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-1-5)',
      minHeight: 'var(--touch-min)',
      padding: '5px 12px',
      background: 'transparent',
      color: '#fff',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--font-ui)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-bold)',
      letterSpacing: 'var(--tracking-btn)',
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: '#fff',
      opacity: 0.9,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '9px',
      opacity: active ? 0.9 : 0,
      transition: 'opacity var(--dur-fast)'
    }
  }, "\u25B6")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": hidden ? 'Näytä reitti' : 'Piilota reitti',
    "aria-pressed": !hidden,
    onClick: onToggleVisibility,
    style: {
      width: 'var(--touch-min)',
      minHeight: 'var(--touch-min)',
      border: 'none',
      borderLeft: '1px solid rgba(255,255,255,0.25)',
      background: 'rgba(0,0,0,0.12)',
      color: hidden ? 'rgba(255,255,255,0.5)' : '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0
    }
  }, hidden ? /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M9.88 9.88a3 3 0 1 0 4.24 4.24"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "2",
    y1: "2",
    x2: "22",
    y2: "22"
  })) : /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }))));
}
Object.assign(__ds_scope, { RouteTab });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/map/RouteTab.jsx", error: String((e && e.message) || e) }); }

// components/map/SignMarker.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const HUE = {
  right: 'var(--marker-right)',
  left: 'var(--marker-left)',
  up_r: 'var(--marker-up-r)',
  up_l: 'var(--marker-up-l)'
};
const STATUS_DOT = {
  suunniteltu: null,
  asetettu: 'var(--status-asetettu-text)',
  tarkistettu: 'var(--status-tarkistettu-text)',
  keratty: 'var(--status-keratty-text)',
  ei_tarpeen: 'var(--status-ei-tarpeen-text)'
};

/**
 * SignMarker — the teardrop map pin (recreation of src/map/icons.ts).
 * 32×52, anchored at the tip (16,52). Circle rotates to bearing; the tip is
 * fixed and points at the exact ground position. Type hue is the constant
 * identity; status only changes OPACITY (planned = faded) + a small dot.
 * `upcoming` types render a dashed ring.
 */
function SignMarker({
  type = 'right',
  bearing = 0,
  status = 'asetettu',
  glyph = '→',
  size = 1,
  style = {},
  ...rest
}) {
  const color = HUE[type] || HUE.right;
  const dashed = type === 'up_r' || type === 'up_l';
  const dot = STATUS_DOT[status];
  const faded = status === 'suunniteltu';
  const w = 32 * size,
    h = 52 * size;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: 'relative',
      width: `${w}px`,
      height: `${h}px`,
      opacity: faded ? 0.45 : 1,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: w,
    viewBox: "0 0 32 32",
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      transform: `rotate(${bearing}deg)`
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "16",
    cy: "16",
    r: "14",
    fill: color,
    stroke: "#fff",
    strokeWidth: "2",
    strokeDasharray: dashed ? '4 2' : undefined
  }), /*#__PURE__*/React.createElement("text", {
    x: "16",
    y: "21",
    textAnchor: "middle",
    fontSize: "15",
    fontWeight: "700",
    fill: "#fff",
    fontFamily: "var(--font-ui)"
  }, glyph)), /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: 10 * size,
    viewBox: "0 0 32 10",
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8,0 L16,10 L24,0 Z",
    fill: color,
    stroke: "#fff",
    strokeWidth: "2"
  })), dot && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: `${2 * size}px`,
      bottom: `${12 * size}px`,
      width: `${8 * size}px`,
      height: `${8 * size}px`,
      borderRadius: '50%',
      background: dot,
      border: '1.5px solid #fff',
      boxSizing: 'border-box'
    }
  }));
}
Object.assign(__ds_scope, { SignMarker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/map/SignMarker.jsx", error: String((e && e.message) || e) }); }

// ui_kits/organizer/MapBackdropOrg.jsx
try { (() => {
/* global React */
// Map backdrop — a believable stand-in for the Leaflet/Maanmittauslaitos
// topographic map under the chrome. The real map is third-party; this is a
// stylised forest-topo backdrop with two GPX route loops, so the kit reads as
// the real product without shipping tiles.
function MapBackdropOrg({
  style = {}
}) {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 800 700",
    preserveAspectRatio: "xMidYMid slice",
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      ...style
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "800",
    height: "700",
    fill: "#f4f1ea"
  }), /*#__PURE__*/React.createElement("g", {
    fill: "#cfe3ef"
  }, /*#__PURE__*/React.createElement("ellipse", {
    cx: "120",
    cy: "540",
    rx: "70",
    ry: "34"
  }), /*#__PURE__*/React.createElement("ellipse", {
    cx: "610",
    cy: "610",
    rx: "52",
    ry: "26"
  }), /*#__PURE__*/React.createElement("ellipse", {
    cx: "700",
    cy: "250",
    rx: "30",
    ry: "44"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M40 180 q60 -30 120 10 q70 40 30 80 q-50 30 -110 0 q-60 -40 -40 -90 Z",
    opacity: "0.7"
  })), /*#__PURE__*/React.createElement("g", {
    stroke: "#bcd6e6",
    strokeWidth: "2.5",
    fill: "none",
    opacity: "0.8"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0 230 q140 30 250 -10 q120 -40 260 10 q120 40 290 -20"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M150 700 q40 -120 -10 -230"
  })), /*#__PURE__*/React.createElement("g", {
    stroke: "#d8cdb8",
    strokeWidth: "1.2",
    fill: "none",
    opacity: "0.7"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M250 120 q120 40 60 140 q-70 90 60 150 q120 50 40 160"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M330 150 q90 50 40 150 q-40 80 60 140"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M520 200 q80 60 20 160 q-40 90 70 150"
  })), /*#__PURE__*/React.createElement("g", {
    stroke: "#cbb8a0",
    strokeWidth: "3",
    fill: "none",
    opacity: "0.6"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0 120 q300 -40 800 60"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M620 0 q-40 350 120 700"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M0 470 q260 60 520 -10 q160 -40 280 30"
  })), /*#__PURE__*/React.createElement("path", {
    d: "M210 250 q-70 80 -30 180 q40 90 150 130 q140 50 250 -10 q120 -60 90 -180 q-30 -120 -180 -150 q-150 -30 -270 30 Z",
    fill: "none",
    stroke: "#7c3aed",
    strokeWidth: "4.5",
    strokeLinejoin: "round",
    opacity: "0.92"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M360 360 q40 -90 150 -70 q90 18 110 90",
    fill: "none",
    stroke: "#f59e0b",
    strokeWidth: "4.5",
    strokeLinecap: "round",
    opacity: "0.95"
  }), /*#__PURE__*/React.createElement("g", {
    fill: "#6b7280",
    fontFamily: "var(--font-ui)",
    fontSize: "15",
    fontStyle: "italic"
  }, /*#__PURE__*/React.createElement("text", {
    x: "430",
    y: "120"
  }, "Oksanper\xE4"), /*#__PURE__*/React.createElement("text", {
    x: "560",
    y: "200"
  }, "Sy\xF6tekyl\xE4"), /*#__PURE__*/React.createElement("text", {
    x: "430",
    y: "560"
  }, "Salmiper\xE4"), /*#__PURE__*/React.createElement("text", {
    x: "120",
    y: "250"
  }, "Lakisuo")));
}
window.MapBackdropOrg = MapBackdropOrg;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/organizer/MapBackdropOrg.jsx", error: String((e && e.message) || e) }); }

// ui_kits/organizer/OrganizerApp.jsx
try { (() => {
/* global React, MapBackdropOrg */
const NS = window.KarttamasterDesignSystem_3ae2ca;
const {
  IconButton,
  Button,
  RouteTab,
  ProgressBar,
  SignMarker,
  MarkerListItem,
  StatusBadge,
  Card,
  Input
} = NS;
const {
  useState
} = React;
const SIGN_LIBRARY = [{
  glyph: '→',
  hue: 'var(--marker-right)',
  type: 'right',
  name: 'Nuoli oikealle'
}, {
  glyph: '←',
  hue: 'var(--marker-left)',
  type: 'left',
  name: 'Nuoli vasemmalle'
}, {
  glyph: '↱',
  hue: 'var(--marker-up-r)',
  type: 'up_r',
  name: 'Tuleva oikealle'
}, {
  glyph: '↰',
  hue: 'var(--marker-up-l)',
  type: 'up_l',
  name: 'Tuleva vasemmalle'
}, {
  glyph: '!',
  hue: 'var(--marker-up-r)',
  type: 'up_r',
  name: 'Varo hyppy'
}, {
  glyph: 'H',
  hue: 'var(--marker-left)',
  type: 'left',
  name: 'Huolto 25 km'
}];
const SEGMENTS = [{
  id: 1,
  name: 'Pohjoislenkki',
  km: '12,0 – 23,8 km',
  who: 'Anni K.',
  color: 'var(--route-1)'
}, {
  id: 2,
  name: 'Salmiperän silmukka',
  km: '23,8 – 38,0 km',
  who: 'Jukka P.',
  color: 'var(--route-3)'
}, {
  id: 3,
  name: 'Itäharju',
  km: '38,0 – 51,2 km',
  who: '',
  color: 'var(--route-4)'
}];
const MAP_MARKERS = [{
  id: 1,
  glyph: '→',
  type: 'right',
  status: 'asetettu',
  x: 30,
  y: 34,
  bearing: 30
}, {
  id: 2,
  glyph: '!',
  type: 'up_r',
  status: 'asetettu',
  x: 44,
  y: 28,
  bearing: 0
}, {
  id: 3,
  glyph: '←',
  type: 'left',
  status: 'tarkistettu',
  x: 58,
  y: 30,
  bearing: 200
}, {
  id: 4,
  glyph: '→',
  type: 'right',
  status: 'suunniteltu',
  x: 64,
  y: 46,
  bearing: 120
}, {
  id: 5,
  glyph: '↰',
  type: 'up_l',
  status: 'suunniteltu',
  x: 52,
  y: 58,
  bearing: 0
}, {
  id: 6,
  glyph: '→',
  type: 'right',
  status: 'kerätty',
  x: 38,
  y: 56,
  bearing: 90
}, {
  id: 7,
  glyph: 'H',
  type: 'left',
  status: 'asetettu',
  x: 46,
  y: 44,
  bearing: 0
}];
function Toolbar({
  placeMode,
  onAddSign,
  onMenu
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-1-5)',
      padding: 'var(--pad-toolbar)',
      background: 'var(--surface-app)',
      color: 'var(--text-body)',
      borderBottom: '1px solid var(--border-subtle)',
      flexShrink: 0,
      position: 'relative',
      zIndex: 30
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: placeMode ? 'danger' : 'primary',
    onClick: onAddSign,
    iconLeft: placeMode ? '✕' : '＋',
    style: placeMode ? {
      background: 'var(--danger)',
      color: '#fff'
    } : {}
  }, placeMode ? 'Peruuta' : 'Merkki'), placeMode && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-meta)',
      color: 'var(--amber-300)',
      whiteSpace: 'nowrap'
    }
  }, "Klikkaa karttaa asettaaksesi"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    iconLeft: "\uD83D\uDCCD"
  }, "GPS"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    style: {
      background: 'var(--accent)'
    }
  }, "J\xE4rjest\xE4j\xE4"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm"
  }, "Kartta"), /*#__PURE__*/React.createElement(IconButton, {
    label: "Valikko",
    onClick: onMenu
  }, "\u22EF"));
}
function StatusOverview() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      padding: '8px 14px',
      background: 'var(--surface-app)',
      borderBottom: '1px solid var(--border-subtle)',
      flexShrink: 0,
      zIndex: 20
    }
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    label: "35 km",
    value: 100,
    detail: "40/40"
  }), /*#__PURE__*/React.createElement(ProgressBar, {
    label: "55 km",
    value: 62,
    detail: "38/61"
  }));
}
function LeftPanel({
  open,
  onToggle
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: open ? '300px' : '0px',
      flexShrink: 0,
      background: 'var(--surface-app)',
      borderRight: open ? '1px solid var(--border-subtle)' : 'none',
      overflow: 'hidden',
      transition: 'width var(--dur-base) var(--ease)',
      position: 'relative',
      zIndex: 15,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '300px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: panelSection
  }, /*#__PURE__*/React.createElement("h3", {
    style: panelHead
  }, "Merkkikirjasto"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '6px'
    }
  }, SIGN_LIBRARY.map((s, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    style: libBtn
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 24,
      height: 24,
      borderRadius: 'var(--radius-sm)',
      background: s.hue,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: 13,
      flexShrink: 0
    }
  }, s.glyph), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      textAlign: 'left',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, s.name))))), /*#__PURE__*/React.createElement("section", {
    style: panelSection
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: panelHead
  }, "P\xE4tk\xE4jako"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm"
  }, "Luo uusi")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      marginTop: '8px'
    }
  }, SEGMENTS.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    style: segRow
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 4,
      alignSelf: 'stretch',
      borderRadius: 2,
      background: s.color
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: 'var(--text-body)'
    }
  }, s.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-meta)',
      color: 'var(--text-muted)'
    }
  }, s.km)), s.who ? /*#__PURE__*/React.createElement(StatusBadge, {
    status: "asetettu"
  }, s.who) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-meta)',
      color: 'var(--text-meta)'
    }
  }, "jakamaton")))))), /*#__PURE__*/React.createElement("button", {
    onClick: onToggle,
    "aria-label": "Sulje paneeli",
    style: collapseTab
  }, "\u25C0"));
}
const panelSection = {
  padding: '12px 14px',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
};
const panelHead = {
  margin: 0,
  fontSize: 'var(--text-meta)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-muted)',
  fontWeight: 700
};
const libBtn = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  minHeight: 'var(--touch-min)',
  padding: '6px 8px',
  background: 'var(--field-tint)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-body)',
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)'
};
const segRow = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px',
  background: 'var(--field-tint)',
  borderRadius: 'var(--radius-sm)'
};
const collapseTab = {
  position: 'absolute',
  top: '50%',
  right: 0,
  transform: 'translateY(-50%)',
  width: 22,
  height: 52,
  background: 'var(--surface-card)',
  border: '1px solid var(--border-default)',
  borderRight: 'none',
  borderRadius: '8px 0 0 8px',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: 11
};
function MapArea({
  placeMode
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      cursor: placeMode ? 'crosshair' : 'default'
    }
  }, /*#__PURE__*/React.createElement(MapBackdropOrg, null), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 12,
      left: 12,
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-marker)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: zoomBtn
  }, "+"), /*#__PURE__*/React.createElement("button", {
    style: {
      ...zoomBtn,
      borderTop: '1px solid #ddd'
    }
  }, "\u2212")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 12,
      right: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-meta)',
      fontWeight: 700,
      letterSpacing: '0.06em',
      padding: '4px 8px',
      borderRadius: 'var(--radius-sm)',
      background: 'rgba(245,158,11,0.18)',
      color: 'var(--amber-300)',
      border: '1px solid rgba(245,158,11,0.3)'
    }
  }, "LUONNOS")), MAP_MARKERS.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.id,
    style: {
      position: 'absolute',
      left: `${m.x}%`,
      top: `${m.y}%`,
      transform: 'translate(-50%,-100%)'
    }
  }, /*#__PURE__*/React.createElement(SignMarker, {
    type: m.type,
    glyph: m.glyph,
    status: m.status,
    bearing: m.bearing
  }))));
}
const zoomBtn = {
  width: 36,
  height: 36,
  background: '#fff',
  border: 'none',
  color: '#333',
  fontSize: 18,
  cursor: 'pointer',
  fontWeight: 700
};
function RouteBar() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-app)',
      color: 'var(--text-body)',
      padding: '8px 14px 10px',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      boxShadow: 'var(--shadow-bar-up)',
      flexShrink: 0,
      zIndex: 20
    }
  }, /*#__PURE__*/React.createElement(RouteTab, {
    label: "35 km",
    color: "var(--route-2)",
    active: true
  }), /*#__PURE__*/React.createElement(RouteTab, {
    label: "55 km",
    color: "var(--route-1)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)',
      marginLeft: '8px',
      fontVariantNumeric: 'tabular-nums'
    }
  }, "0,00 / 34,1 km"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(IconButton, {
    label: "Edellinen",
    variant: "solid"
  }, "\u25C0"), /*#__PURE__*/React.createElement(IconButton, {
    label: "Seuraava",
    variant: "solid"
  }, "\u25B6"));
}
function OrganizerApp() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [placeMode, setPlaceMode] = useState(false);
  return /*#__PURE__*/React.createElement("div", {
    "data-theme": "dark",
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--surface-app)',
      fontFamily: 'var(--font-ui)'
    }
  }, /*#__PURE__*/React.createElement(Toolbar, {
    placeMode: placeMode,
    onAddSign: () => setPlaceMode(p => !p),
    onMenu: () => setPanelOpen(o => !o)
  }), /*#__PURE__*/React.createElement(StatusOverview, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flex: 1,
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement(LeftPanel, {
    open: panelOpen,
    onToggle: () => setPanelOpen(false)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0
    }
  }, !panelOpen && /*#__PURE__*/React.createElement("button", {
    onClick: () => setPanelOpen(true),
    "aria-label": "Avaa paneeli",
    style: {
      position: 'absolute',
      top: '50%',
      left: 0,
      transform: 'translateY(-50%)',
      zIndex: 12,
      width: 22,
      height: 52,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-default)',
      borderLeft: 'none',
      borderRadius: '0 8px 8px 0',
      color: 'var(--text-muted)',
      cursor: 'pointer'
    }
  }, "\u25B6"), /*#__PURE__*/React.createElement(MapArea, {
    placeMode: placeMode
  }))), /*#__PURE__*/React.createElement(RouteBar, null));
}
window.OrganizerApp = OrganizerApp;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/organizer/OrganizerApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volunteer/MapBackdrop.jsx
try { (() => {
/* global React */
// Map backdrop — a believable stand-in for the Leaflet/Maanmittauslaitos
// topographic map under the chrome. The real map is third-party; this is a
// stylised forest-topo backdrop with two GPX route loops, so the kit reads as
// the real product without shipping tiles.
function MapBackdrop({
  style = {}
}) {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 800 700",
    preserveAspectRatio: "xMidYMid slice",
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      ...style
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "800",
    height: "700",
    fill: "#f4f1ea"
  }), /*#__PURE__*/React.createElement("g", {
    fill: "#cfe3ef"
  }, /*#__PURE__*/React.createElement("ellipse", {
    cx: "120",
    cy: "540",
    rx: "70",
    ry: "34"
  }), /*#__PURE__*/React.createElement("ellipse", {
    cx: "610",
    cy: "610",
    rx: "52",
    ry: "26"
  }), /*#__PURE__*/React.createElement("ellipse", {
    cx: "700",
    cy: "250",
    rx: "30",
    ry: "44"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M40 180 q60 -30 120 10 q70 40 30 80 q-50 30 -110 0 q-60 -40 -40 -90 Z",
    opacity: "0.7"
  })), /*#__PURE__*/React.createElement("g", {
    stroke: "#bcd6e6",
    strokeWidth: "2.5",
    fill: "none",
    opacity: "0.8"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0 230 q140 30 250 -10 q120 -40 260 10 q120 40 290 -20"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M150 700 q40 -120 -10 -230"
  })), /*#__PURE__*/React.createElement("g", {
    stroke: "#d8cdb8",
    strokeWidth: "1.2",
    fill: "none",
    opacity: "0.7"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M250 120 q120 40 60 140 q-70 90 60 150 q120 50 40 160"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M330 150 q90 50 40 150 q-40 80 60 140"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M520 200 q80 60 20 160 q-40 90 70 150"
  })), /*#__PURE__*/React.createElement("g", {
    stroke: "#cbb8a0",
    strokeWidth: "3",
    fill: "none",
    opacity: "0.6"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0 120 q300 -40 800 60"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M620 0 q-40 350 120 700"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M0 470 q260 60 520 -10 q160 -40 280 30"
  })), /*#__PURE__*/React.createElement("path", {
    d: "M210 250 q-70 80 -30 180 q40 90 150 130 q140 50 250 -10 q120 -60 90 -180 q-30 -120 -180 -150 q-150 -30 -270 30 Z",
    fill: "none",
    stroke: "#7c3aed",
    strokeWidth: "4.5",
    strokeLinejoin: "round",
    opacity: "0.92"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M360 360 q40 -90 150 -70 q90 18 110 90",
    fill: "none",
    stroke: "#f59e0b",
    strokeWidth: "4.5",
    strokeLinecap: "round",
    opacity: "0.95"
  }), /*#__PURE__*/React.createElement("g", {
    fill: "#6b7280",
    fontFamily: "var(--font-ui)",
    fontSize: "15",
    fontStyle: "italic"
  }, /*#__PURE__*/React.createElement("text", {
    x: "430",
    y: "120"
  }, "Oksanper\xE4"), /*#__PURE__*/React.createElement("text", {
    x: "560",
    y: "200"
  }, "Sy\xF6tekyl\xE4"), /*#__PURE__*/React.createElement("text", {
    x: "430",
    y: "560"
  }, "Salmiper\xE4"), /*#__PURE__*/React.createElement("text", {
    x: "120",
    y: "250"
  }, "Lakisuo")));
}
window.MapBackdrop = MapBackdrop;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volunteer/MapBackdrop.jsx", error: String((e && e.message) || e) }); }

// ui_kits/volunteer/VolunteerApp.jsx
try { (() => {
/* global React, MapBackdrop */
const NS = window.KarttamasterDesignSystem_3ae2ca;
const {
  IconButton,
  Button,
  RouteTab,
  ProgressBar,
  SignMarker,
  MarkerListItem,
  CheckInButton,
  DriveBanner,
  StatusBadge,
  Card
} = NS;
const {
  useState
} = React;

// The volunteer's assigned segment — their slice of the 55km route.
const SEGMENT = {
  name: 'Pohjoislenkki',
  range: '12,0 – 23,8 km',
  markers: [{
    id: 1,
    glyph: '→',
    hue: 'var(--marker-right)',
    type: 'right',
    name: 'Nuoli oikealle',
    km: '12,4 km',
    status: 'asetettu',
    x: 38,
    y: 30,
    bearing: 40
  }, {
    id: 2,
    glyph: '!',
    hue: 'var(--marker-up-r)',
    type: 'up_r',
    name: 'Varo hyppy',
    km: '14,1 km',
    status: 'asetettu',
    x: 56,
    y: 26,
    bearing: 0
  }, {
    id: 3,
    glyph: '←',
    hue: 'var(--marker-left)',
    type: 'left',
    name: 'Nuoli vasemmalle',
    km: '17,8 km',
    status: 'suunniteltu',
    x: 64,
    y: 48,
    bearing: 200
  }, {
    id: 4,
    glyph: '→',
    hue: 'var(--marker-right)',
    type: 'right',
    name: 'Risteys oikealle',
    km: '20,2 km',
    status: 'suunniteltu',
    x: 48,
    y: 62,
    bearing: 120
  }, {
    id: 5,
    glyph: '↰',
    hue: 'var(--marker-up-l)',
    type: 'up_l',
    name: 'Huolto 22 km',
    km: '22,0 km',
    status: 'suunniteltu',
    x: 32,
    y: 52,
    bearing: 0
  }]
};
function Toolbar({
  gps,
  onGps,
  onMenu
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-1-5)',
      padding: 'var(--pad-toolbar)',
      background: 'var(--surface-app)',
      color: 'var(--text-body)',
      borderBottom: '1px solid var(--border-subtle)',
      flexShrink: 0,
      position: 'relative',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: gps ? 'primary' : 'ghost',
    size: "md",
    onClick: onGps,
    iconLeft: "\uD83D\uDCCD",
    style: gps ? {
      background: 'var(--gps-active)',
      color: '#fff'
    } : {}
  }, "GPS"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(IconButton, {
    label: "Valikko",
    onClick: onMenu
  }, "\u22EF"));
}
function SegmentView({
  markers,
  onPick
}) {
  const done = markers.filter(m => m.status !== 'suunniteltu').length;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-app)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '8px 12px',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: '8px',
      marginBottom: '6px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-bold)',
      color: 'var(--text-body)'
    }
  }, SEGMENT.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-meta)',
      color: 'var(--text-muted)'
    }
  }, SEGMENT.range), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 'var(--text-meta)',
      color: 'var(--confirm)',
      fontWeight: 700
    }
  }, done, "/", markers.length)), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: '128px',
      overflowY: 'auto',
      margin: '0 -12px'
    }
  }, markers.map(m => /*#__PURE__*/React.createElement(MarkerListItem, {
    key: m.id,
    glyph: m.glyph,
    hue: m.hue,
    name: m.name,
    km: m.km,
    status: m.status,
    onClick: () => onPick(m),
    style: {
      padding: '8px 12px'
    }
  }))));
}
function MapArea({
  markers,
  onPick
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(MapBackdrop, null), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 10,
      left: 10,
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-marker)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: zoomBtn
  }, "+"), /*#__PURE__*/React.createElement("button", {
    style: {
      ...zoomBtn,
      borderTop: '1px solid #ddd'
    }
  }, "\u2212")), markers.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.id,
    onClick: () => onPick(m),
    style: {
      position: 'absolute',
      left: `${m.x}%`,
      top: `${m.y}%`,
      transform: 'translate(-50%, -100%)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(SignMarker, {
    type: m.type,
    glyph: m.glyph,
    status: m.status,
    bearing: m.bearing,
    size: 0.85
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '44%',
      top: '40%',
      width: 16,
      height: 16,
      borderRadius: '50%',
      background: 'var(--gps-active)',
      border: '3px solid #fff',
      boxShadow: '0 0 0 6px rgba(29,78,216,0.2), var(--shadow-marker)',
      transform: 'translate(-50%,-50%)'
    }
  }));
}
const zoomBtn = {
  width: 36,
  height: 36,
  background: '#fff',
  border: 'none',
  color: '#333',
  fontSize: 18,
  cursor: 'pointer',
  fontWeight: 700
};
function RouteBar({
  drive,
  near
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-app)',
      color: 'var(--text-body)',
      padding: '8px 12px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-1-5)',
      boxShadow: 'var(--shadow-bar-up)',
      flexShrink: 0
    }
  }, drive ? /*#__PURE__*/React.createElement(DriveBanner, {
    distance: near ? '20 m' : '300 m',
    label: near ? 'Olet perillä — Risteys oikealle' : 'Seuraava merkki · Nuoli vasemmalle',
    direction: near ? '↓' : '→',
    near: near
  }) : /*#__PURE__*/React.createElement(ProgressBar, {
    label: "55 km",
    value: 42,
    detail: "2/5"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)'
    }
  }, /*#__PURE__*/React.createElement(RouteTab, {
    label: "55 km",
    color: "var(--route-1)",
    active: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(IconButton, {
    label: "Edellinen merkki",
    variant: "solid"
  }, "\u25C0"), /*#__PURE__*/React.createElement(IconButton, {
    label: "Seuraava merkki",
    variant: "solid"
  }, "\u25B6")));
}
function CheckInModal({
  marker,
  onClose,
  onConfirm
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      background: 'var(--overlay)',
      backdropFilter: 'var(--blur-overlay)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Card, {
    elevation: "modal",
    padding: "md",
    style: {
      width: '100%',
      borderRadius: '14px 14px 0 0',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px'
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    }
  }, /*#__PURE__*/React.createElement(SignMarker, {
    type: marker.type,
    glyph: marker.glyph,
    status: marker.status,
    size: 0.8
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-lg)',
      fontWeight: 700
    }
  }, marker.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-meta)',
      color: 'var(--text-meta)',
      marginTop: 2
    }
  }, marker.km, " \xB7 55-reitti")), /*#__PURE__*/React.createElement(StatusBadge, {
    status: marker.status
  })), /*#__PURE__*/React.createElement(CheckInButton, {
    label: marker.status === 'asetettu' ? 'Merkitse kerätyksi' : 'Merkitse asetetuksi',
    sub: marker.name,
    onConfirm: onConfirm,
    secondary: [{
      label: 'Ei tarpeen',
      variant: 'ghost',
      onClick: onClose
    }, {
      label: 'Lisäsin toisen',
      variant: 'secondary',
      onClick: onClose
    }]
  })));
}
function VolunteerApp() {
  const [markers, setMarkers] = useState(SEGMENT.markers);
  const [gps, setGps] = useState(false);
  const [modal, setModal] = useState(null);
  const drive = gps;
  const confirm = () => {
    setMarkers(ms => ms.map(m => m.id === modal.id ? {
      ...m,
      status: m.status === 'asetettu' ? 'keratty' : 'asetettu'
    } : m));
    setModal(null);
  };
  return /*#__PURE__*/React.createElement("div", {
    "data-theme": "dark",
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      position: 'relative',
      background: 'var(--surface-app)',
      fontFamily: 'var(--font-ui)'
    }
  }, /*#__PURE__*/React.createElement(Toolbar, {
    gps: gps,
    onGps: () => setGps(g => !g),
    onMenu: () => {}
  }), !drive && /*#__PURE__*/React.createElement(SegmentView, {
    markers: markers,
    onPick: setModal
  }), /*#__PURE__*/React.createElement(MapArea, {
    markers: markers,
    onPick: setModal
  }), /*#__PURE__*/React.createElement(RouteBar, {
    drive: drive,
    near: false
  }), modal && /*#__PURE__*/React.createElement(CheckInModal, {
    marker: modal,
    onClose: () => setModal(null),
    onConfirm: confirm
  }));
}
window.VolunteerApp = VolunteerApp;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/volunteer/VolunteerApp.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.StatusBadge = __ds_scope.StatusBadge;

__ds_ns.CheckInButton = __ds_scope.CheckInButton;

__ds_ns.DriveBanner = __ds_scope.DriveBanner;

__ds_ns.MarkerListItem = __ds_scope.MarkerListItem;

__ds_ns.RouteTab = __ds_scope.RouteTab;

__ds_ns.SignMarker = __ds_scope.SignMarker;

})();
