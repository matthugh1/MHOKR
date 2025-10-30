export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">OKR Nexus</h1>
        <p className="text-xl text-muted-foreground mb-8">
          AI-first OKR platform with visual builder and intelligent assistance
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/dashboard"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            Get Started
          </a>
          <a
            href="/docs"
            className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            Documentation
          </a>
        </div>
      </div>
    </main>
  )
}



