              <div className="p-5 space-y-5">
                {/* 1. NAS：挂载信息优先 */}
                {isNasSelected && (
                  <section>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <Plug className="h-4 w-4 text-slate-400" />挂载信息
                    </h4>
                    <div className="grid grid-cols-2 gap-2.5">
                      <DetailField label="协议类型" value={mount?.protocolLabel ?? "—"} />
                      {isS3 ? (
                        <>
                          <DetailField label="传输协议" value={mount?.transportProtocol ?? "—"} />
                          <DetailField label="S3服务" value={mount?.srcPath ?? "—"} className="col-span-2" />
                          <DetailField label="密钥ID" value={mount?.userName ?? "—"} />
                          <DetailField label="密钥" value={mount?.passwordMasked ?? (mount?.hasPassword ? "****" : "—")} />
                          <DetailField label="挂载目录" value={mount?.mountPoint ?? "—"} className="col-span-2" />
                          <DetailField label="管理端目录" value={mount?.managerPath ?? "—"} className="col-span-2" />
                          <DetailField label="权限" value={mount?.permissionLabel ?? "—"} />
                          <DetailField label="限速" value={mount?.maxSpeedLabel ?? "—"} />
                          <DetailField label="附加参数" value={mount?.extraParam ?? "—"} className="col-span-2" />
                        </>
                      ) : (
                        <>
                          <DetailField label="挂载目录" value={mount?.mountPoint ?? "—"} className="col-span-2" />
                          <DetailField label="管理端目录" value={mount?.managerPath ?? "—"} className="col-span-2" />
                          <DetailField label="编码类型" value={mount?.encodingLabel ?? "—"} />
                          <DetailField label="用户" value={mount?.userName ?? "—"} />
                          <DetailField label="数据源" value={mount?.srcPath ?? "—"} className="col-span-2" />
                          <DetailField label="密码" value={mount?.passwordMasked ?? (mount?.hasPassword ? "****" : "—")} />
                          <DetailField label="配额" value={mount?.quotaLabel ?? "—"} />
                          <DetailField label="权限" value={mount?.permissionLabel ?? "—"} />
                          <DetailField label="限速" value={mount?.maxSpeedLabel ?? "—"} />
                          <DetailField label="附加参数" value={mount?.extraParam ?? "—"} className="col-span-2" />
                        </>
                      )}
                    </div>
                    {!mount && (
                      <p className="mt-2 text-xs text-slate-400">挂载明细未同步或未能按序列号关联到 tbl_mount_dir</p>
                    )}
                  </section>
                )}

                {/* 1. 非 NAS：托盘摘要（有则紧挨盘位前） */}
                {!isNasSelected && selected.trays && selected.trays.length > 0 && (
                  <section>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Layers className="h-4 w-4 text-slate-400" />托盘信息</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {selected.trays.map(tray => (
                        <div key={tray.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-center">
                          <p className="text-xs text-slate-400">{tray.label}</p>
                          <p className="text-lg font-bold text-slate-900 mt-1">{tray.usedCount}/{tray.slotCount}</p>
                          <p className="text-[10px] text-slate-400">块/位</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 盘位信息：网盘不展示 */}
                {!isNasSelected && (selected.totalSlots > 0 || slotDetailStatus !== "idle") && (
                  <>
                    {selected.trays && selected.trays.length > 0 ? <Separator /> : null}
                    <section>
                      {/* 标题 + 图例置顶 sticky，滚动盘位时仍可见 */}
                      <div className="sticky top-0 z-10 -mx-1 mb-3 space-y-2 bg-background/95 px-1 py-1 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                          <Grid3X3 className="h-4 w-4 text-slate-400" />盘位信息
                          <span className="text-xs font-normal text-slate-400">（{selected.usedSlots}/{selected.totalSlots} 已占用）</span>
                        </h4>
                        {(!isApiMode() || slotDetailStatus === "ready") && (
                          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                            {([0, 1, 2, 3, 4] as OpticalDiscType[]).map((key) => (
                              <span key={key} className="flex items-center gap-1">
                                <span className={cn("h-2.5 w-2.5 rounded", OPTICAL_DISC_TYPE_COLORS[key].swatch)} />
                                {OPTICAL_DISC_TYPE_LABELS[key]}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {isApiMode() && slotDetailStatus === "loading" && (
                        <div className="py-6 text-center text-xs text-slate-400">正在加载盘位明细...</div>
                      )}
                      {isApiMode() && slotDetailStatus === "empty" && (
                        <div className="py-6 text-center text-xs text-slate-400">
                          盘位明细未同步，当前仅展示汇总
                        </div>
                      )}
                      {isApiMode() && slotDetailStatus === "error" && (
                        <div className="py-6 text-center text-xs text-red-500">
                          盘位明细加载失败，当前仅展示汇总
                        </div>
                      )}
                      <TooltipProvider>
                        {isApiMode() && slotDetailStatus === "ready" && (
                          <div className="space-y-3">
                            {slotGroups.map(group => (
                              <div key={`${selected.siteCode}-${selected.rackId}-${group.cageId}`}>
                                {group.cageName ? (
                                  <p className="mb-1.5 text-xs font-medium text-slate-600">{group.cageName}</p>
                                ) : null}
                                <div
                                  className="grid gap-1"
                                  style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}
                                >
                                  {group.slots.map(slot => renderSlotCell(
                                    slot,
                                    slot.index,
                                    `${slot.sourceSiteId}-${slot.sourceTable}-${slot.sourceId}-${slot.id}`
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {!isApiMode() && (
                          <div
                            className="grid gap-1"
                            style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}
                          >
                            {Array.from({ length: selected.totalSlots }, (_, i) => {
                              const slot = selected.slots?.find(s => s.index === i + 1)
                              return renderSlotCell(slot, i + 1, `${selected.siteCode}-${selected.rackId}-${i + 1}`)
                            })}
                          </div>
                        )}
                      </TooltipProvider>
                    </section>
                  </>
                )}

                {/* 模式控制 + 设备操作：未接真控制，UI 已移除（查看任务用列表入口）。恢复时从 git 历史取回该区块。 */}

                <Separator />

                {/* 2. 基础信息：两列网格 */}
                <section>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Info className="h-4 w-4 text-slate-400" />基础信息</h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <DetailField label="设备名称" value={selected.rackName} />
                    <DetailField label="设备 ID" value={<span className="font-mono">{selected.rackId}</span>} />
                    <DetailField label="序列号" value={<span className="font-mono text-xs">{selected.serialNo ?? "—"}</span>} />
                    <DetailField label="IP 地址" value={<span className="font-mono">{selected.ip ?? "—"}</span>} />
                    <DetailField label="设备类型" value={selected.deviceType ?? "—"} />
                    <DetailField label="所属站点" value={selected.siteName} />
                    {!isNasSelected && (
                      <>
                        <DetailField label="总容量" value={selected.totalCapacity ?? "—"} />
                        <DetailField label="剩余容量" value={selected.remainingCapacity ?? "—"} />
                        <DetailField label="使用率" value={
                          selected.usagePercent != null
                            ? <div className="flex items-center gap-2"><Progress value={selected.usagePercent} className="h-1.5 w-20" /><span>{selected.usagePercent}%</span></div>
                            : "—"
                        } />
                        <DetailField label="当前任务数" value={(selected.currentTaskCount ?? 0).toString()} />
                      </>
                    )}
                    <DetailField label="最近同步" value={formatBeijingTime(selected.lastSyncAt) || "—"} className={!isNasSelected ? undefined : "col-span-2"} />
                  </div>
                </section>

                {/* 关联任务 */}
                {selected.recentTasks && selected.recentTasks.length > 0 && (
                  <>
                    <Separator />
                    <section>
                      <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-slate-400" />关联任务
                        <Button variant="link" size="sm" className="h-auto p-0 text-xs ml-auto" onClick={() => handleViewTasks(selected)}>
                          查看全部 <ChevronRight className="h-3 w-3" />
                        </Button>
                      </h4>
                      <div className="space-y-2">
                        {selected.recentTasks.map(task => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                            onClick={() => { setDrawerOpen(false); router.push(`/tasks?device=${selected.rackId}`) }}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{task.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px]">{task.type}</Badge>
                                <span className="text-[10px] text-slate-400">{formatBeijingTime(task.startedAt) || "—"}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 ml-3 shrink-0">
                              <div className="text-right">
                                <Progress value={task.progress} className="h-1.5 w-16 mb-0.5" />
                                <span className="text-[10px] text-slate-400">{task.progress}%</span>
                              </div>
                              <Badge className={cn("text-[10px]",
                                task.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                                task.status === "failed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                task.status === "running" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                                "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              )}>
                                {task.status === "completed" ? "已完成" : task.status === "failed" ? "已失败" : task.status === "running" ? "运行中" : task.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}

                {/* 设备日志 */}
                {selected.deviceLogs && selected.deviceLogs.length > 0 && (
                  <>
                    <Separator />
                    <section>
                      <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Timer className="h-4 w-4 text-slate-400" />设备日志</h4>
                      <div className="space-y-1.5">
                        {selected.deviceLogs.slice(0, 6).map(log => (
                          <div key={log.id} className={cn("p-2 rounded text-xs font-mono", logLevelColor[log.level])}>
                            <span className="text-slate-400">[{log.timestamp}]</span> {log.message}
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </div>