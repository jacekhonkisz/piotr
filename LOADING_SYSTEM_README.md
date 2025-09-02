# Standardized Loading System

## Overview

This document describes the new standardized loading system that replaces the various inconsistent loading implementations throughout the app. The system provides a unified, professional appearance with informative loading messages in Polish.

## Key Benefits

- **Consistent Design**: All loading states use the same visual language
- **Informative Messages**: Clear Polish text explaining what's happening
- **Progress Indicators**: Optional progress bars for long operations
- **Multiple Variants**: Different styles for different use cases
- **Easy Implementation**: Pre-built components for common scenarios

## Available Components

### 1. Fullscreen Loading Components

#### `DashboardLoading`
- **Use Case**: Dashboard page loading
- **Features**: Progress bar, navy spinner, page background
- **Text**: "Ładowanie dashboardu..."

```tsx
import { DashboardLoading } from '@/components/LoadingSpinner';

if (loading) {
  return <DashboardLoading progress={progress} />;
}
```

#### `ReportsLoading`
- **Use Case**: Reports page loading
- **Features**: Large spinner, progress bar, page background
- **Text**: "Ładowanie raportów..."

```tsx
import { ReportsLoading } from '@/components/LoadingSpinner';

if (loading) {
  return <ReportsLoading progress={progress} />;
}
```

#### `CampaignsLoading`
- **Use Case**: Campaigns page loading
- **Features**: Standard spinner, page background
- **Text**: "Ładowanie kampanii..."

```tsx
import { CampaignsLoading } from '@/components/LoadingSpinner';

if (loading) {
  return <CampaignsLoading />;
}
```

### 2. Component Loading Components

#### `DataLoading`
- **Use Case**: Data component loading
- **Features**: Card layout, progress bar, white background
- **Text**: Customizable (default: "Ładowanie danych...")

```tsx
import { DataLoading } from '@/components/LoadingSpinner';

if (dataLoading) {
  return <DataLoading text="Ładowanie danych klienta..." progress={progress} />;
}
```

#### `InlineLoading`
- **Use Case**: Small inline loading indicators
- **Features**: Minimal spinner, small size
- **Text**: Customizable (default: "Ładowanie...")

```tsx
import { InlineLoading } from '@/components/LoadingSpinner';

<div className="flex items-center space-x-2">
  <span>Status:</span>
  <InlineLoading text="Aktualizowanie..." size="sm" />
</div>
```

#### `ButtonLoading`
- **Use Case**: Button loading states
- **Features**: Minimal spinner, horizontal layout
- **Text**: Customizable (default: "Ładowanie...")

```tsx
import { ButtonLoading } from '@/components/LoadingSpinner';

<button disabled={isLoading}>
  {isLoading ? (
    <ButtonLoading text="Zapisywanie..." />
  ) : (
    'Zapisz'
  )}
</button>
```

#### `LoginLoading`
- **Use Case**: Login page loading states
- **Features**: Centered layout, clean design
- **Text**: Customizable (default: "Ładowanie...")

```tsx
import { LoginLoading } from '@/components/LoadingSpinner';

if (authLoading) {
  return <LoginLoading text="Inicjalizacja..." />;
}
```

### 3. Base Component

#### `LoadingSpinner`
- **Use Case**: Custom loading implementations
- **Features**: Full customization options
- **Props**: All available options

```tsx
import { LoadingSpinner } from '@/components/LoadingSpinner';

<LoadingSpinner
  variant="card"
  size="lg"
  text="Generowanie raportu..."
  progress={67}
  icon={<BarChart3 className="w-8 h-8" />}
  showProgress={true}
  showSpinner={true}
/>
```

## Component Props

### Common Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | Spinner size |
| `text` | `string` | `'Ładowanie...'` | Loading message |
| `className` | `string` | `''` | Additional CSS classes |
| `progress` | `number` | `undefined` | Progress percentage (0-100) |
| `variant` | `'default' \| 'minimal' \| 'fullscreen' \| 'centered' \| 'card'` | `'default'` | Visual style variant |
| `showProgress` | `boolean` | `true` | Show progress bar |
| `showSpinner` | `boolean` | `true` | Show spinner animation |
| `icon` | `ReactNode` | `undefined` | Custom icon above spinner |

### Size Mappings

| Size | Spinner | Text |
|------|---------|------|
| `sm` | 16x16px | text-sm |
| `md` | 32x32px | text-base |
| `lg` | 48x48px | text-lg |
| `xl` | 64x64px | text-xl |

## Implementation Examples

### Page Loading

```tsx
// Dashboard page
const [loading, setLoading] = useState(true);
const [progress, setProgress] = useState(0);

if (loading) {
  return <DashboardLoading progress={progress} />;
}
```

### Component Loading

```tsx
// Data component
const [dataLoading, setDataLoading] = useState(false);
const [dataProgress, setDataProgress] = useState(0);

if (dataLoading) {
  return (
    <DataLoading 
      text="Ładowanie danych z Meta API..." 
      progress={dataProgress} 
    />
  );
}
```

### Button Loading

```tsx
// Form submission
const [isSubmitting, setIsSubmitting] = useState(false);

<button 
  type="submit" 
  disabled={isSubmitting}
  className="btn-primary"
>
  {isSubmitting ? (
    <ButtonLoading text="Zapisywanie..." />
  ) : (
    'Zapisz zmiany'
  )}
</button>
```

### Inline Loading

```tsx
// Status indicator
const [isRefreshing, setIsRefreshing] = useState(false);

<div className="flex items-center space-x-2">
  <span>Status danych:</span>
  {isRefreshing ? (
    <InlineLoading text="Odświeżanie..." size="sm" />
  ) : (
    <span className="text-green-600">Zaktualizowane</span>
  )}
</div>
```

## Migration Guide

### Before (Old Implementation)

```tsx
// Inconsistent loading styles
if (loading) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="spinner h-8 w-8 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading campaigns...</p>
      </div>
    </div>
  );
}
```

### After (New Implementation)

```tsx
// Standardized loading component
import { CampaignsLoading } from '@/components/LoadingSpinner';

if (loading) {
  return <CampaignsLoading />;
}
```

### Files Updated

The following files have been updated to use the new loading system:

- `src/app/dashboard/page.tsx` - Uses `DashboardLoading`
- `src/app/reports/page.tsx` - Uses `ReportsLoading`
- `src/app/campaigns/page.tsx` - Uses `CampaignsLoading`
- `src/app/auth/login/page.tsx` - Uses `DashboardLoading`

## Design System

### Colors

- **Primary**: `navy` (#1F3380)
- **Background**: `page` (#F8FAFC)
- **Text**: `text` (#0F172A)
- **Muted Text**: `muted` (#64748B)
- **Borders**: `stroke` (#E9EDF3)

### Typography

- **Font Family**: Inter, DM Sans, system-ui
- **Font Weights**: Regular (400), Medium (500), Semibold (600), Bold (700)

### Spacing

- **Container Padding**: 8 (32px)
- **Component Spacing**: 4 (16px), 6 (24px)
- **Border Radius**: xl (12px)

## Best Practices

1. **Use Pre-built Components**: Prefer the specific loading components over the base `LoadingSpinner`
2. **Progress for Long Operations**: Include progress bars for operations that take more than 2 seconds
3. **Descriptive Text**: Use specific, actionable loading messages
4. **Consistent Placement**: Place loading states in the same location across similar components
5. **Accessibility**: Loading states are automatically accessible with proper ARIA attributes

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure you're importing from the correct path
2. **TypeScript Errors**: Check that all required props are provided
3. **Styling Issues**: Verify Tailwind classes are available in your build

### Debug Mode

To see all loading components in action, visit the examples page:

```tsx
import LoadingExamplesPage from '@/components/LoadingExamples';

// Add to your routing to see all variants
```

## Future Enhancements

- [ ] Skeleton loading states
- [ ] Animated progress bars
- [ ] Loading state persistence
- [ ] Custom loading animations
- [ ] Loading state analytics

## Support

For questions or issues with the loading system, refer to:
- Component documentation in `src/components/LoadingSpinner.tsx`
- Examples in `src/components/LoadingExamples.tsx`
- This README file
