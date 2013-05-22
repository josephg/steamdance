# in order for the algorithm to be non-global, engines must be limited in
# range.
# or, we must pre-calculate global regions.
# however, I don't think it makes sense for one engine to affect the whole
# atmosphere.
# solutions:
# 1. engines can be infinite range, but every square that touches 'ground'
# becomes ground, and sky is ground.
#
# ---------------       ---------------
# Ppppppppppppppp       Ppppppx        
# -----+x+-------  -->  -----+x+-------
#      |x|                   |x|
#      |x|                   | |
#
# in this case, we either have to touch everything to the right of the split,
# (which is O(s*n)) or at step time we have to do many indirections to find the
# region.
# There might be some clever way to chunk regions into larger bits so we can
# amortise the cost of region recalc, but the case of a long pipe with a
# shuttle will still need to recalc a bunch.
#
# ... hm, maybe we could chunk regions into 8x8 blocks? eg, do connectivity at
# a coarse scale first and a fine scale second.
#
#    | |
#    | |
#  +-+ +--- becomes a node in a graph that is connected to the right and bottom.
#  | +-----
#  | |
#
#  --------
#  --------
#             would be 2 nodes.
#  --------
#  --------
#
# ... actually that seems hard and i don't know how it'd work.
#
#
#
# *** google for compressible fluid sim?
