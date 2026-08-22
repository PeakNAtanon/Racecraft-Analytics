import Link from "next/link";

export default function DriverNotFound() {
  return <div className="empty"><h1>404</h1><p>Driver profile not found.</p><Link href="/drivers" className="link-arrow">Back to Drivers →</Link></div>;
}
