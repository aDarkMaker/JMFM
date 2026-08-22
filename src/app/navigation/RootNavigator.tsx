import React from 'react';
import {Text, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import LibraryScreen from '../screens/LibraryScreen';
import TasksScreen from '../screens/TasksScreen';
import SettingsScreen from '../screens/SettingsScreen';
import {Icon, IconName} from '../components/Icon';
import {theme} from '../theme';
import {commonStyles} from '../styles/common';
import {MainTabParamList, RootStackParamList} from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const renderTabIcon =
  (name: IconName) =>
  ({color, size}: {color: string; size: number}) =>
    <Icon name={name} size={size} color={color} />;

function MainTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.signal,
        tabBarInactiveTintColor: theme.colors.mist,
        tabBarStyle: {
          backgroundColor: theme.colors.cloud,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: '首页',
          tabBarIcon: renderTabIcon('home'),
        }}
      />
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{
          title: '漫画库',
          tabBarIcon: renderTabIcon('auto-stories'),
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          title: '下载',
          tabBarIcon: renderTabIcon('download'),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: '设置',
          tabBarIcon: renderTabIcon('settings'),
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="MainTabs" component={MainTabs} options={{headerShown: false}} />
        <Stack.Screen
          name="AlbumDetail"
          component={PlaceholderScreen}
          options={{title: '专辑详情'}}
        />
        <Stack.Screen
          name="Reader"
          component={PlaceholderScreen}
          options={{title: '阅读器'}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function PlaceholderScreen(): React.JSX.Element {
  return (
    <View style={commonStyles.screen}>
      <View style={commonStyles.center}>
        <Text>功能建设中</Text>
      </View>
    </View>
  );
}
