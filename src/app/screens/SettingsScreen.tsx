import React, {useEffect} from 'react';
import {Pressable, ScrollView, Text, TextInput, View} from 'react-native';
import {useSettingsStore} from '../stores/useSettingsStore';
import {commonStyles} from '../styles/common';
import {settingsStyles} from '../styles/screens/settings';

const FORMAT_OPTIONS = ['webp', 'jpg'];
const THREAD_OPTIONS = [1, 2, 4, 8];

function SettingsScreen(): React.JSX.Element {
  const settings = useSettingsStore(state => state.settings);
  const loaded = useSettingsStore(state => state.loaded);
  const load = useSettingsStore(state => state.load);
  const update = useSettingsStore(state => state.update);

  useEffect(() => {
    if (!loaded) {
      load();
    }
  }, [loaded, load]);

  return (
    <View style={commonStyles.screen}>
      <View style={commonStyles.header}>
        <Text style={commonStyles.headerTitle}>设置</Text>
      </View>
      <ScrollView>
        <Text style={settingsStyles.sectionTitle}>下载</Text>
        <View style={settingsStyles.row}>
          <View style={settingsStyles.labelWrap}>
            <Text style={settingsStyles.label}>保存路径</Text>
            <Text style={settingsStyles.value}>{settings.downloadPath}</Text>
          </View>
          <TextInput
            style={settingsStyles.input}
            value={settings.downloadPath}
            onChangeText={text => update({downloadPath: text})}
            placeholder="JMFMobile/downloads"
          />
        </View>
        <View style={settingsStyles.row}>
          <View style={settingsStyles.labelWrap}>
            <Text style={settingsStyles.label}>失败重试次数</Text>
          </View>
          <TextInput
            style={settingsStyles.input}
            value={String(settings.retryTimes)}
            onChangeText={text => {
              const n = Number(text);
              if (Number.isFinite(n)) {
                update({retryTimes: n});
              }
            }}
            keyboardType="number-pad"
          />
        </View>
        <View style={settingsStyles.row}>
          <View style={settingsStyles.labelWrap}>
            <Text style={settingsStyles.label}>并发线程</Text>
          </View>
          <View style={settingsStyles.pickerRow}>
            {THREAD_OPTIONS.map(option => {
              const active = settings.imageThreads === option;
              return (
                <Pressable
                  key={option}
                  style={[settingsStyles.chip, active && settingsStyles.chipActive]}
                  onPress={() => update({imageThreads: option})}
                >
                  <Text style={[settingsStyles.chipText, active && settingsStyles.chipTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={settingsStyles.row}>
          <View style={settingsStyles.labelWrap}>
            <Text style={settingsStyles.label}>图片格式</Text>
          </View>
          <View style={settingsStyles.pickerRow}>
            {FORMAT_OPTIONS.map(option => {
              const active = settings.imageFormat === option;
              return (
                <Pressable
                  key={option}
                  style={[settingsStyles.chip, active && settingsStyles.chipActive]}
                  onPress={() => update({imageFormat: option})}
                >
                  <Text style={[settingsStyles.chipText, active && settingsStyles.chipTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={settingsStyles.row}>
          <View style={settingsStyles.labelWrap}>
            <Text style={settingsStyles.label}>代理</Text>
            <Text style={settingsStyles.value}>留空表示直连</Text>
          </View>
          <TextInput
            style={settingsStyles.input}
            value={settings.proxy}
            onChangeText={text => update({proxy: text})}
            placeholder="http://127.0.0.1:7890"
            autoCapitalize="none"
          />
        </View>
      </ScrollView>
    </View>
  );
}

export default SettingsScreen;
