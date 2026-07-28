from netalertx_bridge.mapping import map_event_type


def test_known_event_type_maps_to_expected_technique():
    rules = map_event_type("new_device")
    assert [r.attack_id for r in rules] == ["T1200"]


def test_rogue_dhcp_maps_to_dhcp_spoofing_subtechnique():
    rules = map_event_type("rogue_dhcp_server")
    assert [r.attack_id for r in rules] == ["T1557.003"]


def test_unknown_event_type_has_no_mapping():
    assert map_event_type("device_down") == []
    assert map_event_type("totally_made_up") == []
