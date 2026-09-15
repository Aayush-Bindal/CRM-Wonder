'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { CRMProvider, useCRM } from '@/lib/crmContext';
import { Lead } from '@/lib/types';
import Navbar from '@/components/Navbar';
import AuthModal from '@/components/AuthModal';
import LeadDetailsDrawer from '@/components/LeadDetailsDrawer';
import QuickAddLeadModal from '@/components/sales-rep/QuickAddLeadModal';

// Sales Rep Views
import TodayPriorityView from '@/components/sales-rep/TodayPriorityView';
import MyLeadsView from '@/components/sales-rep/MyLeadsView';

// Admin Views
import MasterControlView from '@/components/admin/MasterControlView';
import TeamFollowupsView from '@/components/admin/TeamFollowupsView';
import FullLeadDatabaseView from '@/components/admin/FullLeadDatabaseView';
import UserManagementView from '@/components/admin/UserManagementView';

import {
  Calendar,
  Users,
  Database,
  ShieldCheck,
  X,
  Plus,
  Menu,
} from 'lucide-react';

const emptySubscribe = () => () => {};

function CRMApp() {
  const { currentUser, todayPriorityFollowups, visibleLeads } = useCRM();

  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [activeTab, setActiveTab] = useState<string>('priority');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isMobileTabMenuOpen, setIsMobileTabMenuOpen] = useState(false);

  // Avoid hydration mismatch by waiting for client mount
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-2 font-mono text-xs text-[#828282]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff682c] animate-pulse" />
          <span>WONDER CRM</span>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show minimalist login screen
  if (!currentUser) {
    return <AuthModal />;
  }

  const isAdmin = currentUser.role === 'Admin';

  // Available tabs based on role
  const repTabs = [
    {
      id: 'priority',
      label: "Today's Priority",
      badge: todayPriorityFollowups.length,
      badgeColor: 'bg-[#ff682c] text-white',
    },
    {
      id: 'my-leads',
      label: 'My Leads',
      badge: visibleLeads.length,
      badgeColor: 'bg-[#efefef] text-[#202020]',
    },
  ];

  const adminTabs = [
    {
      id: 'master-control',
      label: 'Master Control',
      badge: null,
      badgeColor: '',
    },
    {
      id: 'team-followups',
      label: 'Team Follow-ups',
      badge: null,
      badgeColor: '',
    },
    {
      id: 'leads',
      label: 'Lead Database',
      badge: null,
      badgeColor: '',
    },
    {
      id: 'users',
      label: 'User Management',
      badge: null,
      badgeColor: '',
    },
  ];

  const activeTabsList = isAdmin ? adminTabs : repTabs;

  // Make sure activeTab is valid for current role
  const isCurrentTabValid = activeTabsList.some((t) => t.id === activeTab);
  const currentTab = isCurrentTabValid ? activeTab : activeTabsList[0].id;
  const currentTabObj = activeTabsList.find((t) => t.id === currentTab) || activeTabsList[0];

  return (
    <div className="min-h-screen bg-[#ffffff] text-[#202020] flex flex-col font-sans selection:bg-[#ff682c] selection:text-white">
      {/* Top Navigation with Wonder branding & restored profile menu */}
      <Navbar />

      {/* Main Responsive Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Tab Bar with Mobile Hamburger & Action Controls */}
        <div className="flex items-center justify-between gap-2 pb-1 relative">
          {/* Mobile View (< md): 1 selected tab with hamburger on the side */}
          <div className="relative md:hidden">
            <button
              id="mobile-tab-hamburger-btn"
              onClick={() => setIsMobileTabMenuOpen(!isMobileTabMenuOpen)}
              className="bg-[#efefef] hover:bg-[#e4e4e4] border border-[#d4d4d4] pl-3.5 pr-2.5 py-1.5 rounded-full flex items-center gap-2 text-xs font-mono text-[#202020] transition-colors"
              aria-label="Toggle navigation tabs"
            >
              <span className="font-semibold">{currentTabObj.label}</span>
              {currentTabObj.badge !== null && currentTabObj.badge !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    currentTabObj.badgeColor || 'bg-[#ff682c] text-white'
                  }`}
                >
                  {currentTabObj.badge}
                </span>
              )}
              <div className="w-px h-3.5 bg-[#cfcfcf] mx-0.5" />
              {isMobileTabMenuOpen ? (
                <X className="w-4 h-4 text-[#ff682c]" />
              ) : (
                <Menu className="w-4 h-4 text-[#202020]" />
              )}
            </button>

            {/* Mobile Tabs Dropdown */}
            {isMobileTabMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsMobileTabMenuOpen(false)}
                />
                <div className="absolute left-0 top-full mt-2 w-60 bg-white border border-[#e0e0e0] rounded-xl shadow-xl z-30 p-1.5 space-y-1 animate-in fade-in zoom-in-95">
                  <p className="text-[10px] font-mono text-[#828282] uppercase px-2.5 py-1 tracking-wider">
                    {isAdmin ? 'Admin Modules' : 'Workspace Views'}
                  </p>
                  {activeTabsList.map((tab) => {
                    const isTabActive = currentTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        id={`mobile-tab-select-${tab.id}`}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setIsMobileTabMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono rounded-lg transition-colors text-left ${
                          isTabActive
                            ? 'bg-[#202020] text-white font-medium'
                            : 'text-[#4d4d4d] hover:bg-[#f5f5f5] hover:text-[#202020]'
                        }`}
                      >
                        <span>{tab.label}</span>
                        {tab.badge !== null && tab.badge !== undefined && (
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                              isTabActive
                                ? 'bg-[#ff682c] text-white'
                                : tab.badgeColor || 'bg-[#efefef] text-[#202020]'
                            }`}
                          >
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Desktop View (>= md): Full horizontal pill bar */}
          <div className="hidden md:flex bg-[#efefef] p-1 rounded-full items-center gap-1 border border-[#e8e8e8] shrink-0">
            {activeTabsList.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-btn-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-1.5 text-xs font-mono rounded-full transition-all flex items-center gap-2 whitespace-nowrap ${
                    isActive
                      ? 'bg-[#202020] text-white shadow-sm font-medium'
                      : 'text-[#4d4d4d] hover:text-[#202020] hover:bg-[#e4e4e4]'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.badge !== null && tab.badge !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive ? 'bg-[#ff682c] text-white' : tab.badgeColor
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Add Lead Action Button (Hidden on Lead Database tab as requested) */}
          {currentTab !== 'leads' && (
            <button
              id="main-quick-add-lead-btn"
              onClick={() => setIsQuickAddOpen(true)}
              className="px-3.5 py-1.5 bg-[#202020] hover:bg-black text-white text-xs font-mono flex items-center gap-1.5 shrink-0 transition-colors rounded-full"
            >
              <Plus className="w-3.5 h-3.5 text-[#ff682c] shrink-0" />
              <span className="font-medium">Add Lead</span>
            </button>
          )}
        </div>

        {/* Dynamic View Routing */}
        <div className="pb-16">
          {/* Sales Rep Dashboard Views */}
          {!isAdmin && currentTab === 'priority' && (
            <TodayPriorityView
              onSelectLead={(lead) => setSelectedLead(lead)}
            />
          )}

          {!isAdmin && currentTab === 'my-leads' && (
            <MyLeadsView
              onSelectLead={(lead) => setSelectedLead(lead)}
            />
          )}

          {/* Admin Dashboard Views */}
          {isAdmin && currentTab === 'master-control' && (
            <MasterControlView
              onSelectLead={(lead) => setSelectedLead(lead)}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {isAdmin && currentTab === 'team-followups' && (
            <TeamFollowupsView onSelectLead={(lead) => setSelectedLead(lead)} />
          )}

          {isAdmin && currentTab === 'leads' && (
            <FullLeadDatabaseView
              onSelectLead={(lead) => setSelectedLead(lead)}
            />
          )}

          {isAdmin && currentTab === 'users' && <UserManagementView />}
        </div>
      </main>

      {/* Slideover & Modals */}
      <LeadDetailsDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
      />

      <QuickAddLeadModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
      />
    </div>
  );
}

export default function Home() {
  return (
    <CRMProvider>
      <CRMApp />
    </CRMProvider>
  );
}
