import { useState } from 'react'
import './App.css'
import Home from './components/Home'
import Register from './components/Register'
import Login from './components/Login'
import Navbar from './components/Navbar'
import BookAppointment from './components/BookAppointment'
import { Routes, Route, useLocation } from 'react-router-dom'
import { ProtectedRoute, GuestRoute, AllowGroupsRoute, BlockGroupsRoute } from "./components/ProtectedRoutes";
import ListOfVisits from './components/ListOfVisits'
import AiPanel from './components/AiPanel'

function App() {
  const location = useLocation()
  const noNavbar = location.pathname === "/Register" || location.pathname === "/login"

  return (
    <>
      {
        noNavbar ?

          <Routes>

            <Route element={<GuestRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/Register" element={<Register />} />
            </Route>

          </Routes>

          :

          <Navbar
            content={
              <Routes>

                <Route element={<ProtectedRoute />}>

                  <Route element={<AllowGroupsRoute allowedGroups={["AiEngineer"]} />}>
                    <Route path="/ai-panel" element={<AiPanel />} />
                  </Route>


                  <Route element={<BlockGroupsRoute blockedGroups={["doctor", "AiEngineer"]} />}>
                    <Route path="/book-appointment" element={<BookAppointment />} />
                  </Route>

                  <Route element={<BlockGroupsRoute blockedGroups={["AiEngineer"]} />}>
                    <Route path="/your-visits" element={<ListOfVisits />} />
                  </Route>

                </Route>

                <Route path="/" element={<Home />} />

              </Routes>
            }
          />
      }
    </>
  )
}

export default App
