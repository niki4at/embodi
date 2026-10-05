import React from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

type BoundaryState = {
  error: Error | null
}

/**
 * A Convex query throw or a render crash used to unmount the tree and leave
 * a blank document. This keeps a real screen up so the session can be
 * reloaded instead of dying on white. Convex errors embed whole documents and
 * validators, so the raw message is only shown in development.
 */
export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  BoundaryState
> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Bodfit screen crashed', error, info.componentStack)
  }

  private recover = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign(window.location.origin + '/')
      return
    }
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <View style={styles.fill}>
        <Text style={styles.title}>Bodfit couldn&apos;t open this screen</Text>
        <Text style={styles.message}>
          Something went wrong while loading your data. Head back to Home and
          try again.
        </Text>
        {__DEV__ ? (
          <Text style={styles.devDetails} numberOfLines={6}>
            {error.message}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={this.recover}
          style={styles.button}
        >
          <Text style={styles.buttonLabel}>Back to Home</Text>
        </Pressable>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    color: '#111111',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: '#444444',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
  },
  devDetails: {
    color: '#888888',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#111111',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
})
