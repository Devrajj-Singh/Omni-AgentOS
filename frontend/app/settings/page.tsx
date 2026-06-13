'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Brain, Cpu, Info, Palette } from 'lucide-react'
import { getSettings, updateModel } from '@/services/api'
import { useSettingsStore } from '@/store/settings-store'
import { AboutSection } from '@/components/settings/about-section'
import { MemorySettings } from '@/components/settings/memory-settings'
import { ModelSelector } from '@/components/settings/model-selector'
import { SettingsSection } from '@/components/settings/settings-section'
import { ThemePicker } from '@/components/settings/theme-picker'

export default function SettingsPage(): JSX.Element {
  const {
    activeModel,
    availableModels,
    memoryCount,
    setSettings,
    setActiveModel,
    setMemoryCount,
    isLoading,
    error,
    setLoading,
    setError,
  } = useSettingsStore()

  useEffect(() => {
    async function loadSettings(): Promise<void> {
      setLoading(true)
      setError(null)
      try {
        const data = await getSettings()
        setSettings({
          activeModel: data.activeModel,
          availableModels: data.availableModels,
          memoryCount: data.memoryCount,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    }

    void loadSettings()
  }, [setError, setLoading, setSettings])

  const handleModelSelect = async (modelId: string): Promise<void> => {
    try {
      const data = await updateModel(modelId)
      setActiveModel(data.activeModel)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update model')
      throw err
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-6 px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>
          <p className="mt-1 text-sm text-text-muted">Configure your AI workspace</p>
        </motion.div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}

        {error && <div className="rounded-xl border border-status-red/25 bg-status-red/10 px-4 py-3 text-sm text-status-red">{error}</div>}

        {!isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-6">
            <SettingsSection
              title="AI Model"
              description="Select which model powers your conversations"
              icon={<Cpu className="h-4 w-4 text-accent" />}
            >
              <ModelSelector models={availableModels} activeModel={activeModel} onSelect={handleModelSelect} />
            </SettingsSection>

            <SettingsSection
              title="Appearance"
              description="Choose your accent color theme"
              icon={<Palette className="h-4 w-4 text-accent" />}
            >
              <ThemePicker />
            </SettingsSection>

            <SettingsSection
              title="Memory"
              description="Manage your stored conversation memories"
              icon={<Brain className="h-4 w-4 text-accent" />}
            >
              <MemorySettings memoryCount={memoryCount} onCountChange={setMemoryCount} />
            </SettingsSection>

            <SettingsSection
              title="About"
              description="Stack and version information"
              icon={<Info className="h-4 w-4 text-text-muted" />}
            >
              <AboutSection />
            </SettingsSection>
          </motion.div>
        )}
      </div>
    </div>
  )
}
