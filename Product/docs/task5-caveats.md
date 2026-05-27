# Task 5 Caveats

1. The principled line is at the locked floor with `+152` cp at depth 14. Future iteration should aim for at least `+200` cp margin.
2. The position was found by candidate search and is more artificial than the other calibration tasks. Ecological validity is weaker.
3. The swindle line depends on an unrealistic opponent move sequence (`Bb8-h8` in the search trace). The test remains valid because Task 5 is interpretive rather than played out, but the dependency should be flagged.

If real players produce noisy `swindle_preference` data after launch, Task 5 is the first task to replace.