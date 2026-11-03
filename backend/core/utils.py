from datetime import datetime, timedelta, timezone
import time


class DateTimeUtil:

    @staticmethod
    def time_now(timestamp: bool = False):
        now = time.time()

        if not timestamp:
            dt_now = datetime.fromtimestamp(now)
            return dt_now.isoformat()

        return now

    @staticmethod
    def get_relative_time(timestamp: bool = False, days: int = 0, hours: int = 0, minutes: int = 0, seconds: int = 0):
        now = datetime.now()
        res = now + timedelta(days=days, hours=hours, minutes=minutes, seconds=seconds)

        if not timestamp:
            return res.isoformat()

        return res.timestamp()