import Link from "next/link";

export default function NotFound() {
  return <div className="empty"><h1>404</h1><p>The requested record was not found.</p><Link href="/" className="link-arrow">Back to Current Round →</Link></div>;
}
