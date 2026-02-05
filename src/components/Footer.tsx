'use client'

import { useTheme } from './ThemeProvider'

export default function Footer() {
  const { theme } = useTheme()

  // Texte du message automatique (encodé pour l'URL)
  const autoMessage = encodeURIComponent(
    "Hello, I am contacting you from Vertex Biolabs. I would like to get more information about your pharmaceutical products, and about how to ship them."
  );

  return (
    <footer className={`${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-800'} text-white py-8 mt-auto border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-700'}`}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
          
          <div className="text-center md:text-left">
            <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
              Vertex Biolabs
            </h3>
            <p className="text-sm text-gray-400 italic">Precision & Quality in Pharmaceutical Products</p>
            <p className="text-xs text-gray-500 mt-1">Developed by Eng. Lagoung</p>
            <p className="text-xs text-gray-500 mt-4 font-mono">© 2026 Vertex Biolabs. All rights reserved.</p>
          </div>

          <div className="flex flex-col items-center space-y-4">
            <p className="text-sm font-semibold tracking-widest uppercase text-gray-300">Contact our Experts</p>
            <div className="flex space-x-8">
              {/* WHATSAPP avec message auto */}
              <a 
                href={`https://wa.me/237692118391?text=${autoMessage}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="group relative"
                aria-label="WhatsApp"
              >
                <div className="absolute -inset-2 bg-green-500/20 rounded-full blur opacity-0 group-hover:opacity-100 transition duration-300"></div>
                <svg className="w-10 h-10 text-green-500 group-hover:text-green-400 transform group-hover:scale-110 transition-all duration-300 relative" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </a>

              {/* TELEGRAM avec message auto */}
              <a 
                href={`https://t.me/VertexBiolabsSupport?text=${autoMessage}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="group relative"
                aria-label="Telegram"
              >
                <div className="absolute -inset-2 bg-blue-500/20 rounded-full blur opacity-0 group-hover:opacity-100 transition duration-300"></div>
                <svg className="w-10 h-10 text-blue-400 group-hover:text-blue-300 transform group-hover:scale-110 transition-all duration-300 relative" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.68c.223-.198-.054-.308-.346-.11l-6.4 4.02-2.76-.918c-.6-.187-.612-.6.125-.89l10.782-4.156c.5-.18.943.11.78.89z"/>
                </svg>
              </a>
            </div>
            <div className={`px-4 py-1 rounded-full text-xs font-medium ${theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-700 text-gray-300'}`}>
              Contact external support.
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
