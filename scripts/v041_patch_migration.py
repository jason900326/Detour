from pathlib import Path

path = Path('scripts/v041_ux_flow.py')
text = path.read_text()
start = text.find('old_catch = """')
end_marker = 'prepare = prepare.replace(old_catch, new_catch, 1)\n'
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('old catch migration section not found')
end += len(end_marker)

replacement = r'''new_catch = """    } catch (error) {
      stopLocationWatcher();

      const message =
        error instanceof Error
          ? error.message
          : '請確認網路和定位服務後再試一次。';
      const testSessionId = playtestSessionIdRef.current;

      setTicketBuildStatus('這張票沒有印成功');
      setTicketBuildError(message);
      routeProgress.stopAnimation();

      if (testSessionId) {
        setPlaytestSessions(
          await updatePlaytestSession(testSessionId, {
            status: 'ticket-failed',
            failureReason: message.slice(0, 120),
          })
        );
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
"""
prepare, catch_count = re.subn(
    r"    \} catch \(error\) \{\n      stopLocationWatcher\(\);\n      transitionTo\('mood'\);.*?\n      Alert\.alert\(.*?\n      \);\n    \}\n",
    lambda _match: new_catch,
    prepare,
    count=1,
    flags=re.S,
)
if catch_count != 1:
    raise SystemExit('prepare catch block missing')
'''

path.write_text(text[:start] + replacement + text[end:])
