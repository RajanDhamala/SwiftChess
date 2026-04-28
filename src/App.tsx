import DemoApp from './demo/DemoApp'

function App() {
  const path = window.location.pathname

  if (path === '/npm-test') {
    return <DemoApp />
  }

  return (
    <main className="max-w-3xl mx-auto p-6 text-center">
      <h1 className="text-3xl font-bold text-gray-100">SwiftChess Package Workspace</h1>
      <p className="mt-3 text-gray-300">
        Use <code className="bg-black/25 px-1.5 py-0.5 rounded">/npm-test</code> to test the library as a consumer.
      </p>
      <a
        className="inline-block mt-5 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
        href="/npm-test"
      >
        Open npm-test route
      </a>
    </main>
  )
}

export default App
