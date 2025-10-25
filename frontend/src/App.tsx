import { useState } from 'react'
import Navbar from '@/components/Navbar'
import MarketData from '@/pages/MarketData'
import Backtest from '@/pages/Backtest'
import Optimization from '@/pages/Optimization'
import Live from '@/pages/Live'
import Settings from '@/pages/Settings'

function App() {
  const [activeTab, setActiveTab] = useState('market')

  const renderPage = () => {
    switch (activeTab) {
      case 'market':
        return <MarketData />
      case 'backtest':
        return <Backtest />
      case 'optimization':
        return <Optimization />
      case 'live':
        return <Live />
      case 'settings':
        return <Settings />
      default:
        return <MarketData />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
      <main>{renderPage()}</main>
    </div>
  )
}

export default App
