import { Icon } from "./icons";

// Cada status carrega ícone + rótulo: a cor sozinha nunca informa (WCAG 1.4.1).
const tones = {
  ok: { chip: "success", icon: "checkCircle" },
  warn: { chip: "warning", icon: "alert" },
  fail: { chip: "danger", icon: "error" },
};

export default function Checklist({ items }) {
  return (
    <ul className="checklist">
      {items.map((item) => {
        const tone = tones[item.type] ?? tones.warn;

        return (
          <li className="check-item" key={item.item}>
            <span>{item.item}</span>
            <span className={`chip ${tone.chip}`}>
              <Icon name={tone.icon} size={13} />
              {item.status}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
