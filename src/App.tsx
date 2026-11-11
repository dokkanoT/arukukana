import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AppLayout } from './components/AppLayout.tsx'
import { AuthGate } from './features/auth/AuthGate.tsx'
import { BuryPage } from './features/bury/BuryPage.tsx'
import { FriendsPage } from './features/friends/FriendsPage.tsx'
import { FriendsProvider } from './features/friends/FriendsProvider.tsx'
import { InboxPage } from './features/letter/InboxPage.tsx'
import { InboxProvider } from './features/letter/InboxProvider.tsx'
import { LetterPage } from './features/letter/LetterPage.tsx'
import { LocationProvider } from './features/location/LocationProvider.tsx'
import { MapPage } from './features/map/MapPage.tsx'
import { ServerViewPage } from './features/server-view/ServerViewPage.tsx'
import { WelcomeGate } from './features/welcome/WelcomeGate.tsx'

function App() {
  return (
    <AuthGate>
      <LocationProvider>
        <InboxProvider>
          <FriendsProvider>
            <WelcomeGate>
              <BrowserRouter>
                <Routes>
                  <Route element={<AppLayout />}>
                    <Route index element={<MapPage />} />
                    <Route path="bury" element={<BuryPage />} />
                    <Route path="inbox" element={<InboxPage />} />
                    <Route path="letter/:id" element={<LetterPage />} />
                    <Route path="letter/:id/server" element={<ServerViewPage />} />
                    <Route path="friends" element={<FriendsPage />} />
                    {/* 知らないURLは地図に戻す */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </WelcomeGate>
          </FriendsProvider>
        </InboxProvider>
      </LocationProvider>
    </AuthGate>
  )
}

export default App
