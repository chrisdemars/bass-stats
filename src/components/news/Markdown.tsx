import Link from "next/link";
import { Fragment } from "react";

/**
 * Minimal, allowlist-only Markdown renderer.
 *
 * Article bodies arrive from scrapers, so nothing here touches
 * dangerouslySetInnerHTML — only the handful of constructs recaps actually use
 * (h2/h3, paragraphs, bold, italics, links, bullets) become elements, and
 * anything else renders as plain text.
 */
export function Markdown({ source }: { source: string }) {
  const blocks = source.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        if (block.startsWith("### ")) {
          return (
            <h3 key={i} className="headline pt-2 text-xl">
              {inline(block.slice(4))}
            </h3>
          );
        }
        if (block.startsWith("## ")) {
          return (
            <h2 key={i} className="headline border-t border-line pt-6 text-2xl">
              {inline(block.slice(3))}
            </h2>
          );
        }
        if (/^[-*] /m.test(block) && block.split("\n").every((l) => /^[-*] /.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 text-ink/85">
              {block.split("\n").map((line, j) => (
                <li key={j}>{inline(line.replace(/^[-*] /, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-[0.975rem] leading-7 text-ink/85">
            {inline(block)}
          </p>
        );
      })}
    </div>
  );
}

/** Bold, italics and links — resolved left to right, no nesting. */
function inline(text: string): React.ReactNode[] {
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
    const [, linkText, href, bold, italic] = m;
    if (linkText && href) {
      const internal = href.startsWith("/");
      out.push(
        internal ? (
          <Link key={key++} href={href} className="text-accent underline underline-offset-2">
            {linkText}
          </Link>
        ) : (
          <a
            key={key++}
            href={href}
            rel="noopener noreferrer nofollow"
            target="_blank"
            className="text-accent underline underline-offset-2"
          >
            {linkText}
          </a>
        ),
      );
    } else if (bold) {
      out.push(<strong key={key++} className="font-semibold text-ink">{bold}</strong>);
    } else if (italic) {
      out.push(<em key={key++}>{italic}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return out;
}
