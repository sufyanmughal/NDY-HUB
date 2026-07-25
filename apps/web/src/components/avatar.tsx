/** Photo-or-initials avatar — shared by Topbar, Settings, and the Passport
 * card so "show the real photo if set, else a gradient initial" lives in
 * one place instead of three slightly-different copies. */
export function Avatar({
  photoUrl,
  name,
  size = 40,
  className = "",
}: {
  photoUrl?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const initial = (name.trim().charAt(0) || "N").toUpperCase();

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 font-semibold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}
