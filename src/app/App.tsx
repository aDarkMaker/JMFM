import React from 'react';
import {SafeAreaView, StyleSheet, Text} from 'react-native';

// Placeholder only. UI will be designed separately later.
function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <Text>JMFMobile</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default App;
