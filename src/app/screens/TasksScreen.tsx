import React from 'react';
import {FlatList, Pressable, Text, View} from 'react-native';
import {Icon} from '../components/Icon';
import {ProgressBar} from '../components/ProgressBar';
import {EmptyState} from '../components/EmptyState';
import {useDownloadStore} from '../stores/useDownloadStore';
import {commonStyles} from '../styles/common';
import {tasksStyles} from '../styles/screens/tasks';
import {theme} from '../theme';

const STATUS_TEXT: Record<string, string> = {
  pending: '等待中',
  downloading: '下载中',
  paused: '已暂停',
  done: '已完成',
  error: '失败',
};

function TasksScreen(): React.JSX.Element {
  const tasks = useDownloadStore(state => state.tasks);
  const update = useDownloadStore(state => state.update);
  const remove = useDownloadStore(state => state.remove);

  if (tasks.length === 0) {
    return (
      <View style={commonStyles.screen}>
        <View style={commonStyles.header}>
          <Text style={commonStyles.headerTitle}>下载</Text>
        </View>
        <EmptyState
          icon="download"
          title="暂无下载任务"
          hint="从漫画详情页点击下载后，任务会出现在这里"
        />
      </View>
    );
  }

  const toggle = (task: (typeof tasks)[number]) => {
    const next = task.status === 'downloading' ? 'paused' : 'downloading';
    update(task.id, {status: next});
  };

  return (
    <View style={commonStyles.screen}>
      <View style={commonStyles.header}>
        <Text style={commonStyles.headerTitle}>下载</Text>
      </View>
      <FlatList
        data={tasks}
        keyExtractor={item => item.id}
        contentContainerStyle={tasksStyles.list}
        renderItem={({item}) => (
          <View style={tasksStyles.taskCard}>
            <View style={tasksStyles.row}>
              <Text style={tasksStyles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={tasksStyles.status}>{STATUS_TEXT[item.status]}</Text>
            </View>
            <View style={tasksStyles.progress}>
              <ProgressBar progress={item.progress} />
            </View>
            <View style={tasksStyles.actions}>
              <Pressable style={tasksStyles.actionButton} onPress={() => toggle(item)}>
                <Icon
                  name={item.status === 'downloading' ? 'pause' : 'play-arrow'}
                  size={20}
                  color={theme.colors.ink}
                />
              </Pressable>
              <Pressable style={tasksStyles.actionButton} onPress={() => remove(item.id)}>
                <Icon name="delete" size={20} color={theme.colors.ink} />
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

export default TasksScreen;
