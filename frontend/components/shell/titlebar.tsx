 'use client'
 
 import { LayoutGrid, PanelRight, Terminal } from 'lucide-react'
 import { useUIStore } from '@/store/ui-store'
 
 export interface TitlebarProps {
   title?: string
 }
 
 export function Titlebar({ title = 'Omni AgentOS' }: TitlebarProps): JSX.Element {
   const { sidebarOpen, activityPanelOpen, terminalPanelOpen, toggleSidebar, toggleActivityPanel, toggleTerminalPanel } = useUIStore()
 
   return (
     <div className="os-titlebar flex h-12 items-center justify-between px-3">
       <div className="flex items-center gap-3">
         <div className="flex items-center gap-2">
           <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(255, 95, 86, 0.95)' }} aria-hidden />
           <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(255, 189, 46, 0.95)' }} aria-hidden />
           <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(39, 201, 63, 0.95)' }} aria-hidden />
         </div>
 
         <div className="min-w-0">
           <div className="truncate text-sm font-semibold text-text-primary">
             {title}
           </div>
           <div className="truncate text-[11px] text-text-muted">
             AI workspace • chat • dev • memory
           </div>
         </div>
       </div>
 
       <div className="flex items-center gap-2">
         <button
           type="button"
           onClick={toggleSidebar}
           className={`os-toolbar-btn inline-flex h-8 items-center gap-2 px-3 text-xs font-semibold ${sidebarOpen ? 'text-text-primary' : 'text-text-muted'}`}
           aria-pressed={sidebarOpen}
           aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
           title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
         >
           <LayoutGrid className="h-3.5 w-3.5" />
           <span className="hidden sm:inline">Sidebar</span>
         </button>
 
         <button
           type="button"
           onClick={toggleTerminalPanel}
           className={`os-toolbar-btn inline-flex h-8 items-center gap-2 px-3 text-xs font-semibold ${terminalPanelOpen ? 'text-text-primary' : 'text-text-muted'}`}
           aria-pressed={terminalPanelOpen}
           aria-label={terminalPanelOpen ? 'Hide terminal' : 'Show terminal'}
           title={terminalPanelOpen ? 'Hide terminal' : 'Show terminal'}
         >
           <Terminal className="h-3.5 w-3.5" />
           <span className="hidden sm:inline">Terminal</span>
         </button>
 
         <button
           type="button"
           onClick={toggleActivityPanel}
           className={`os-toolbar-btn inline-flex h-8 items-center gap-2 px-3 text-xs font-semibold ${activityPanelOpen ? 'text-text-primary' : 'text-text-muted'}`}
           aria-pressed={activityPanelOpen}
           aria-label={activityPanelOpen ? 'Hide activity' : 'Show activity'}
           title={activityPanelOpen ? 'Hide activity' : 'Show activity'}
         >
           <PanelRight className="h-3.5 w-3.5" />
           <span className="hidden sm:inline">Activity</span>
         </button>
       </div>
     </div>
   )
 }
 
 export default Titlebar
