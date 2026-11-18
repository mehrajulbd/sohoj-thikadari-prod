import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="loading-screen">
      <h1>এই পেইজ পাওয়া যায়নি</h1>
      <Link className="button primary" href="/">
        হোমে ফিরে যান / Go home
      </Link>
    </main>
  );
}
