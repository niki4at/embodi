import { CheckInScreen } from '@/components/checkin'
import React from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

export default function CheckInPage() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <CheckInScreen />
    </GestureHandlerRootView>
  )
}
