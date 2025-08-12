export default function TestTailwind() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Tailwind CSS Test</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Card 1</h2>
            <p className="text-gray-600">This is a test card to verify Tailwind CSS is working.</p>
            <button className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors">
              Test Button
            </button>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Card 2</h2>
            <p className="text-gray-600">Another test card with different styling.</p>
            <button className="mt-4 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition-colors">
              Success Button
            </button>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Card 3</h2>
            <p className="text-gray-600">A third card to test responsive grid layout.</p>
            <button className="mt-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition-colors">
              Danger Button
            </button>
          </div>
        </div>
        
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Utility Classes Test</h3>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              <span className="text-gray-700">Red circle</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <span className="text-gray-700">Green circle</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
              <span className="text-gray-700">Blue circle</span>
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-white text-lg">
            If you can see styled cards, colors, and layout above, Tailwind CSS is working correctly!
          </p>
        </div>
      </div>
    </div>
  );
} 