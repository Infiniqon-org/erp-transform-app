/**
 * Barrel for the Augmentation marquee components.
 *
 * Spec mandate: export ONLY the four public components (PromptTemplateEditor,
 * DragDropRuleBuilder, AdvancedConfiguration, TemplateLibraryDrawer). Sibling
 * helpers (CardinalityChip, ParameterPill, ColumnTile, OperationSlot,
 * GeneratedPromptPreview, LivePreviewPanel, ModeToggle) and the internal
 * hooks (usePromptParser, useCardinalityDetect, useDnDColumns, usePlanBuilder,
 * useAugmentationDraft) stay reachable via their direct module paths so
 * consumers cannot accidentally couple to internals.
 */

export { PromptTemplateEditor } from "./PromptTemplateEditor"
export type {
  PromptTemplateEditorProps,
  EditorColumn,
} from "./PromptTemplateEditor"

export { DragDropRuleBuilder } from "./DragDropRuleBuilder"
export type { DragDropRuleBuilderProps } from "./DragDropRuleBuilder"

export { AdvancedConfiguration } from "./AdvancedConfiguration"
export type {
  AdvancedConfigurationProps,
  DetectedColumn,
} from "./AdvancedConfiguration"

export { TemplateLibraryDrawer } from "./TemplateLibraryDrawer"
export type { TemplateLibraryDrawerProps } from "./TemplateLibraryDrawer"
