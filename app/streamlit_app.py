"""Coordinator dashboard.  Run:  streamlit run app/streamlit_app.py"""
import sys
from pathlib import Path

import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from journey_compass.channel import suggest_channel  # noqa: E402
from journey_compass.messaging import draft_message  # noqa: E402
from journey_compass.pipeline import run  # noqa: E402
from journey_compass.recommender import recommend  # noqa: E402

st.set_page_config(page_title="Journey Compass", layout="wide")
st.title("Journey Compass")
st.caption("A personal next step for every participant, instead of one broadcast message.")

df = st.cache_data(run)()

c1, c2, c3, c4 = st.columns(4)
c1.metric("Participants", len(df))
c2.metric("Active", int((df["stage"] == "Active").sum()))
c3.metric("Cooling", int((df["stage"] == "Cooling").sum()))
c4.metric("Dormant", int((df["stage"] == "Dormant").sum()))

st.subheader("Recommended next steps")
stage = st.multiselect("Stage", ["Active", "Cooling", "Dormant"], default=["Active", "Cooling", "Dormant"])
view = df[df["stage"].isin(stage)]
st.dataframe(view[["participant_id", "first_name", "city", "stage", "days_since_last",
                   "next_action", "next_item", "channel"]], hide_index=True, width="stretch")

st.subheader("Participant detail")
names = (df["participant_id"] + " - " + df["first_name"]).tolist()
pick = st.selectbox("Choose a participant", names)
person = df.iloc[names.index(pick)].to_dict()

left, right = st.columns(2)
with left:
    st.markdown(f"**Stage:** {person['stage']}  \n"
                f"**Courses:** {', '.join(person['courses_taken'])}  \n"
                f"**Events / seva:** {person['num_events']} / {person['num_seva']}  \n"
                f"**Last contact:** {person['last_contact']:%Y-%m-%d} ({person['days_since_last']} days ago)")
    st.markdown(f"**Next step:** {person['next_item']}  \n**Why:** {person['reason']}  \n"
                f"**Channel:** {person['channel']}")
with right:
    if st.button("Draft personalized message"):
        step = recommend(person)
        st.text_area("Draft", draft_message(person, step, suggest_channel(person, step.action)), height=220)
